import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { IsNull, LessThan, Repository } from 'typeorm';
import { MailService } from '../common/mail/mail.service';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { PasswordReset } from './entities/password-reset.entity';

/** How long a mailed OTP stays valid. */
const CODE_TTL_MS = 10 * 60 * 1000;
/** Minimum gap between two codes for the same account (throttles mail spam). */
const RESEND_COOLDOWN_MS = 60 * 1000;
/** Wrong guesses before a code is burned — caps brute force well under 1e6. */
const MAX_ATTEMPTS = 5;
/** Lifetime of the token handed out after the code checks out. */
const RESET_TOKEN_TTL = '10m';
/** Reset rows older than this are swept on the next request. */
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;
/** Marks a JWT as a reset token — login tokens share the secret, not the job. */
const RESET_TOKEN_PURPOSE = 'password_reset';

// Deliberately identical whatever happened: a caller must not be able to tell a
// real admin username from a typo, or a reset in cooldown from a fresh send.
const GENERIC_FORGOT_RESPONSE = {
  message:
    'If that account can reset its password, a 6-digit code has been sent to the email on file.',
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @InjectRepository(PasswordReset)
    private readonly resets: Repository<PasswordReset>,
  ) {}

  async register(dto: RegisterDto) {
    // Bootstrap-only: the first registered user becomes the admin, and
    // registration is closed once any user exists (staff accounts are created
    // by an admin via UsersController). The check runs atomically inside
    // createSelfSignup so concurrent registrations can't both become admin.
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.createSelfSignup({
      name: dto.name,
      username: dto.username,
      password: hashedPassword,
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    // Username or email: an admin who has forgotten their password usually
    // remembers the address the reset code goes to, so refusing it here would
    // lock them out of the very screen that rescues them.
    const user = await this.usersService.findByIdentifierWithPassword(
      dto.username,
    );
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid username or password');
    }
    return this.buildAuthResponse(user);
  }

  /** Current user, loaded fresh from the DB so permission changes apply on reload. */
  async me(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      avatar: user.avatar,
      allowedPages: user.allowedPages,
    };
  }

  /**
   * Step 1 — mail a one-time code.
   *
   * Restricted to admins: a cashier who forgets their password gets it reset by
   * an admin in the staff page, which keeps the self-service path (and the
   * mailbox that guards it) down to the one account that can't be rescued any
   * other way. The response never varies, so this endpoint can't be used to
   * probe which usernames exist.
   */
  async requestPasswordReset(dto: ForgotPasswordDto) {
    void this.pruneOldResets();

    const user = await this.usersService.findByIdentifier(dto.identifier);
    if (!user || user.role !== Role.ADMIN || !user.isActive || !user.email) {
      return GENERIC_FORGOT_RESPONSE;
    }

    // Throttle: ignore a repeat request while the previous code is still fresh,
    // so a held-down "resend" can't flood the mailbox.
    const latest = await this.latestOutstandingReset(user.id);
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      return GENERIC_FORGOT_RESPONSE;
    }

    // randomInt is the CSPRNG — Math.random() would make codes guessable.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    // Only the newest code may be used: retire anything still outstanding.
    await this.resets.update(
      { userId: user.id, consumedAt: IsNull() },
      { consumedAt: new Date() },
    );
    await this.resets.save(
      this.resets.create({
        userId: user.id,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      }),
    );

    const minutes = Math.round(CODE_TTL_MS / 60000);
    try {
      await this.mailService.send({
        to: user.email,
        subject: `Your password reset code: ${code}`,
        text:
          `Hi ${user.name},\n\n` +
          `Your password reset code is ${code}.\n` +
          `It expires in ${minutes} minutes and can only be used once.\n\n` +
          `If you didn't ask to reset your password, ignore this email — ` +
          `your current password still works.\n`,
        html: resetEmailHtml(user.name, code, minutes),
      });
    } catch (err) {
      // Don't surface the failure: doing so would confirm the account exists.
      // The log is where the shop owner finds out their SMTP settings are wrong.
      this.logger.error(
        `Failed to send password reset email to user ${user.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return GENERIC_FORGOT_RESPONSE;
  }

  /**
   * Step 2 — trade a valid code for a short-lived reset token.
   *
   * The token, not the code, authorises the change: it means the new-password
   * screen never has to hold the code, and the code is burned the moment it is
   * accepted.
   */
  async verifyResetCode(dto: VerifyResetCodeDto) {
    // One message for every failure mode (unknown user, expired, wrong digits)
    // so guessing tells the caller nothing beyond "not this one".
    const invalid = () =>
      new BadRequestException('That code is invalid or has expired');

    const user = await this.usersService.findByIdentifier(dto.identifier);
    if (!user || user.role !== Role.ADMIN || !user.isActive) {
      throw invalid();
    }

    const reset = await this.latestOutstandingReset(user.id);
    if (!reset || reset.expiresAt.getTime() < Date.now()) {
      throw invalid();
    }

    if (!(await bcrypt.compare(dto.code, reset.codeHash))) {
      const attempts = reset.attempts + 1;
      await this.resets.update(reset.id, {
        attempts,
        // Out of guesses: burn the code so the attacker has to request a new
        // one (which re-arms the cooldown and re-alerts the mailbox owner).
        consumedAt: attempts >= MAX_ATTEMPTS ? new Date() : undefined,
      });
      throw invalid();
    }

    await this.resets.update(reset.id, { consumedAt: new Date() });

    return {
      resetToken: this.jwtService.sign(
        { sub: user.id, rid: reset.id, purpose: RESET_TOKEN_PURPOSE },
        { expiresIn: RESET_TOKEN_TTL },
      ),
    };
  }

  /** Step 3 — set the new password against a token from step 2. */
  async resetPassword(dto: ResetPasswordDto) {
    const expired = () =>
      new BadRequestException(
        'This reset has expired — request a new code and try again',
      );

    let payload: { sub?: number; rid?: number; purpose?: string };
    try {
      payload = this.jwtService.verify(dto.resetToken);
    } catch {
      throw expired();
    }
    // A login token must not double as a reset token: same secret, different job.
    if (
      payload.purpose !== RESET_TOKEN_PURPOSE ||
      !payload.sub ||
      !payload.rid
    ) {
      throw expired();
    }

    // The row is the one-time guard — a replayed token finds it completed.
    const reset = await this.resets.findOne({
      where: { id: payload.rid, userId: payload.sub, completedAt: IsNull() },
    });
    if (!reset) {
      throw expired();
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || user.role !== Role.ADMIN || !user.isActive) {
      throw expired();
    }

    await this.usersService.setPassword(user.id, dto.password);
    await this.resets.update(reset.id, { completedAt: new Date() });

    // NOTE: JWTs already issued to this account stay valid until they expire —
    // there is no token blocklist. A reset locks the thief out of *logging in
    // again*, not out of a session they already hold.
    return { message: 'Password updated — sign in with your new password' };
  }

  /** Newest code for this user that hasn't been used up. */
  private latestOutstandingReset(
    userId: number,
  ): Promise<PasswordReset | null> {
    return this.resets.findOne({
      where: { userId, consumedAt: IsNull() },
      order: { id: 'DESC' },
    });
  }

  /** Housekeeping so the table doesn't grow forever. Failures are non-fatal. */
  private async pruneOldResets(): Promise<void> {
    try {
      await this.resets.delete({
        createdAt: LessThan(new Date(Date.now() - PRUNE_AFTER_MS)),
      });
    } catch (err) {
      this.logger.warn(
        `Could not prune old password resets: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private buildAuthResponse(user: User) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        avatar: user.avatar,
        allowedPages: user.allowedPages,
      },
    };
  }
}

/**
 * The OTP email body. Inline styles only, and a table-free layout — mail
 * clients strip <style> blocks and disagree about everything else. The plain
 * text version in send() is the fallback for clients that refuse HTML.
 */
function resetEmailHtml(name: string, code: string, minutes: number): string {
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f3f0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e7e1db">
    <p style="margin:0 0 8px;font-size:15px;color:#44403c">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#44403c">Use this code to reset your password:</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;color:#1c1917;background:#faf7f4;border:1px solid #e7e1db;border-radius:12px;padding:18px 8px">${code}</div>
    <p style="margin:24px 0 0;font-size:13px;color:#78716c">It expires in ${minutes} minutes and can only be used once.</p>
    <p style="margin:12px 0 0;font-size:13px;color:#78716c">If you didn't ask to reset your password, ignore this email — your current password still works.</p>
  </div>
</div>`;
}

/** The name is user-supplied, so it can't go into the HTML body raw. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
