import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../common/enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  username: string;

  // select: false → password is never returned by default queries.
  @Column({ select: false })
  password: string;

  // Profile picture URL (uploaded via /uploads/image). null = use initial.
  // Explicit type: TypeORM can't infer a column type from a `string | null` union.
  @Column({ type: 'varchar', nullable: true })
  avatar: string | null;

  @Column({ type: 'enum', enum: Role, default: Role.CASHIER })
  role: Role;

  // Sidebar pages a cashier is allowed to see (keys from the frontend's
  // permissions list). null = fall back to the default cashier pages.
  // Ignored for admins, who always see every page.
  @Column({ type: 'simple-json', nullable: true })
  allowedPages: string[] | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
