import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { User } from './entities/user.entity';

export interface CreateUserData {
  name: string;
  username: string;
  password: string; // already hashed
  role?: Role;
  avatar?: string;
}

export interface NewUserInput {
  name: string;
  username: string;
  password: string; // plain text — hashed here
  role: Role;
  avatar?: string;
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

  create(data: CreateUserData): Promise<User> {
    const user = this.repo.create(data);
    return this.repo.save(user);
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
    const password = await bcrypt.hash(input.password, 10);
    const user = await this.create({
      name: input.name,
      username: input.username,
      password,
      role: input.role,
      avatar: input.avatar,
    });
    // Never leak the (hashed) password back to the client.
    return this.repo.create({ ...user, password: undefined });
  }

  count(): Promise<number> {
    return this.repo.count();
  }
}
