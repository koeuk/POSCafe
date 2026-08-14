import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A one-time password-reset code issued to an admin who forgot their password.
 *
 * The code itself is never stored — only a bcrypt hash — so a leaked database
 * dump can't be replayed into an account takeover. Rows are kept after use
 * (consumedAt set) rather than deleted, which gives the resend throttle and any
 * later audit a record of what was sent.
 */
@Entity('password_resets')
export class PasswordReset {
  @PrimaryGeneratedColumn()
  id: number;

  // No FK relation: the lookup is always "latest code for this user id", and
  // keeping it a plain column avoids loading the user on every check.
  @Index()
  @Column()
  userId: number;

  // bcrypt hash of the 6-digit code.
  @Column()
  codeHash: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  // Wrong guesses so far. At MAX_ATTEMPTS the code is burned, so a 6-digit
  // space (1e6) can't be walked by brute force.
  @Column({ default: 0 })
  attempts: number;

  // Set once the code has been exchanged for a reset token, so the same code
  // can't be used twice.
  @Column({ type: 'datetime', nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
