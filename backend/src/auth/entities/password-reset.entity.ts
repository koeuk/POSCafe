import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * A one-time password-reset code issued to an admin who forgot their password.
 *
 * The code itself is never stored — only a bcrypt hash — so a leaked database
 * dump can't be replayed into an account takeover. Rows are kept after use
 * (consumedAt set) rather than deleted, which gives the resend throttle and any
 * later audit a record of what was sent.
 */
@Entity('password_resets')
@Index('IDX_password_resets_userId_createdAt', ['userId', 'createdAt'])
@Index('IDX_password_resets_createdAt', ['createdAt'])
export class PasswordReset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_password_resets_userId',
  })
  user: User;

  // bcrypt hash of the 6-digit code.
  @Column({ type: 'varchar', length: 255 })
  codeHash: string;

  // Wrong guesses so far. At MAX_ATTEMPTS the code is burned, so a 6-digit
  // space (1e6) can't be walked by brute force.
  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'datetime', precision: 6 })
  expiresAt: Date;

  // Set once the code has been exchanged for a reset token, so the same code
  // can't be verified twice.
  @Column({ type: 'datetime', precision: 6, nullable: true })
  consumedAt: Date | null;

  // Set once the password has actually been changed. The reset token names its
  // own row, so this is what stops a captured token from being replayed to
  // change the password a second time.
  @Column({ type: 'datetime', precision: 6, nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
