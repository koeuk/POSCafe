import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { User } from './entities/user.entity';

export interface CreateUserData {
  name: string;
  username: string;
  password: string; // already hashed
  role?: Role;
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

  count(): Promise<number> {
    return this.repo.count();
  }
}
