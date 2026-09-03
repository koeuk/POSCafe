import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  inventoryItemId: number;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  // Signed change (+ = restock, - = deduction)
  @Column('decimal', { precision: 12, scale: 3 })
  delta: number;

  @Column('decimal', { precision: 12, scale: 3 })
  stockAfter: number;

  // e.g. 'restock', 'order_deduction', 'order_refund', 'correction'
  @Column({ default: 'restock' })
  reason: string;

  @Column({ type: 'int', nullable: true })
  orderId: number | null;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
