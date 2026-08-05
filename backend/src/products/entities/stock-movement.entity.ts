import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
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
@Index(['productId', 'createdAt'])
export class StockMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productId: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  // Size the change applies to, or null for a sizeless product's base stock.
  @Column({ type: 'varchar', length: 255, nullable: true })
  size: string | null;

  // Signed change to the stock level (+ = restock, − = correction/waste).
  @Column()
  delta: number;

  // Stock level right after this change, so the feed can show "→ 30".
  @Column()
  stockAfter: number;

  // Who made the change. Kept when the user is deleted (SET NULL).
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
