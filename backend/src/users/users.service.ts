import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

export interface CreateUserData {
  name: string;
  username: string;
  password: string; // already hashed
  email?: string | null;
  role?: Role;
  avatar?: string;
  allowedPages?: string[];
}

export interface NewUserInput {
  name: string;
  username: string;
  password: string; // plain text — hashed here
  email?: string | null;
  role: Role;
  avatar?: string;
  allowedPages?: string[];
}

/**
 * Trims and lowercases an email so the unique index and the reset lookup agree,
 * and turns an empty string into null — the staff form submits "" when the
 * field is cleared, and a blank address must not occupy the unique index.
 */
function normalizeEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.repo.find();
  }

  findById(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username } });
  }

  /** Includes the password column (needed for login verification). */
  findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :username', { username })
      .getOne();
  }

  /** findByIdentifier, plus the password column (for login verification). */
  findByIdentifierWithPassword(identifier: string): Promise<User | null> {
    const value = identifier.trim();
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :value', { value })
      .orWhere('LOWER(user.email) = LOWER(:value)', { value })
      .getOne();
  }

  /**
   * Looks a user up by either username or email — sign-in and the reset form
   * both accept whichever the staff member remembers. Email is matched
   * case-insensitively
   * because staff type it however their keyboard felt at the time; MySQL's
   * default collation already does this, LOWER() makes it explicit and
   * collation-independent.
   */
  findByIdentifier(identifier: string): Promise<User | null> {
    const value = identifier.trim();
    return this.repo
      .createQueryBuilder('user')
      .where('user.username = :value', { value })
      .orWhere('LOWER(user.email) = LOWER(:value)', { value })
      .getOne();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() })
      .getOne();
  }

  /** Sets a new password from an already-verified reset. `password` is plain text. */
  async setPassword(id: number, password: string): Promise<void> {
    await this.repo.update(id, { password: await bcrypt.hash(password, 10) });
  }

  create(data: CreateUserData): Promise<User> {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  /**
   * Bootstrap-only self-signup: creates the very first account as ADMIN, and
   * is closed once any user exists — staff accounts are created by an admin
   * via UsersController after that. Runs the count→insert in one transaction
   * with a row-range lock so two simultaneous first registrations can't both
   * read an empty table and both become admin. `password` must already be
   * hashed.
   */
  async createSelfSignup(data: {
    name: string;
    username: string;
    password: string;
  }): Promise<User> {
    return this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      // FOR UPDATE over the users range serializes concurrent registrations
      // (InnoDB gap-locks the empty range), so the bootstrap admin is unique.
      const count = await repo
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .getCount();
      if (count > 0) {
        throw new ForbiddenException(
          'Registration is closed — ask an admin to create your account',
        );
      }
      const user = repo.create({ ...data, role: Role.ADMIN });
      return repo.save(user);
    });
  }

  /**
   * Admin-facing user creation: rejects duplicate usernames, hashes the
   * password, and returns the user without the password field.
   */
  async createUser(input: NewUserInput): Promise<User> {
    const existing = await this.findByUsername(input.username);
    if (existing) {
      throw new ConflictException('Username already taken');
    }
    const email = normalizeEmail(input.email);
    if (email && (await this.findByEmail(email))) {
      throw new ConflictException('Email already in use');
    }
    const password = await bcrypt.hash(input.password, 10);
    const user = await this.create({
      name: input.name,
      username: input.username,
      password,
      email,
      role: input.role,
      avatar: input.avatar,
      // Page restrictions only apply to cashiers.
      allowedPages:
        input.role === Role.CASHIER ? input.allowedPages : undefined,
    });
    // Never leak the (hashed) password back to the client.
    return this.repo.create({ ...user, password: undefined });
  }

  /** Admin-facing update. Re-hashes the password only when a new one is given. */
  async updateUser(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (dto.username && dto.username !== user.username) {
      const existing = await this.findByUsername(dto.username);
      if (existing) {
        throw new ConflictException('Username already taken');
      }
    }
    const email = dto.email === undefined ? undefined : normalizeEmail(dto.email);
    if (email) {
      const existing = await this.findByEmail(email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    const patch: Partial<User> = {};
    if (email !== undefined) patch.email = email;
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.username !== undefined) patch.username = dto.username;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.avatar !== undefined) patch.avatar = dto.avatar;
    if (dto.allowedPages !== undefined) patch.allowedPages = dto.allowedPages;
    if (dto.password) patch.password = await bcrypt.hash(dto.password, 10);
    // Promotion to admin clears any cashier page restrictions.
    if (dto.role === Role.ADMIN) patch.allowedPages = null;

    await this.repo.update(id, patch);
    // findById excludes the password column (select: false).
    return (await this.findById(id)) as User;
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.repo.delete(id);
  }

  count(): Promise<number> {
    return this.repo.count();
  }
}
