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
import { Product } from './product.entity';

/**
 * One manual stock change (restock or correction) made by a staff member.
 * Sales and cancellations are not duplicated here — they are already fully
 * recorded on orders/order_items; this table is the audit trail for the
 * hand-entered changes that orders can't explain.
 */
@Entity('stock_movements')
@Index('IDX_stock_movements_productId_createdAt', ['productId', 'createdAt'])
export class StockMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  productId: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'productId',
    foreignKeyConstraintName: 'FK_stock_movements_productId',
  })
  product: Product;

  // Signed change to the stock level (+ = restock, − = correction/waste).
  @Column({ type: 'int' })
  delta: number;

  // Stock level right after this change, so the feed can show "→ 30".
  @Column({ type: 'int' })
  stockAfter: number;

  // Who made the change. Kept when the user is deleted (SET NULL).
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_stock_movements_userId',
  })
  user: User | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
