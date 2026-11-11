import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../common/enums/role.enum';

@Entity('users')
@Index('UQ_users_username', ['username'], { unique: true })
@Index('UQ_users_email', ['email'], { unique: true })
@Index('IDX_users_role_isActive', ['role', 'isActive'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  username: string;

  // select: false → password is never returned by default queries.
  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  // Recovery address for the forgot-password OTP. Nullable and unique: MySQL
  // allows many NULLs in a unique index, so accounts without an email (every
  // cashier, by default) don't collide with each other.
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  // Profile picture URL (uploaded via /uploads/image). null = use initial.
  // Explicit type: TypeORM can't infer a column type from a `string | null` union.
  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string | null;

  @Column({ type: 'enum', enum: Role, default: Role.CASHIER })
  role: Role;

  // Sidebar pages a cashier is allowed to see (keys from the frontend's
  // permissions list). null = fall back to the default cashier pages.
  // Ignored for admins, who always see every page.
  @Column({ type: 'json', nullable: true })
  allowedPages: string[] | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
