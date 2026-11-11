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
import { Order } from '../../orders/entities/order.entity';
import { User } from '../../users/entities/user.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity('inventory_movements')
@Index('IDX_inventory_movements_inventoryItemId_createdAt', [
  'inventoryItemId',
  'createdAt',
])
@Index('IDX_inventory_movements_orderId_reason', ['orderId', 'reason'])
export class InventoryMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  inventoryItemId: number;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'inventoryItemId',
    foreignKeyConstraintName: 'FK_inventory_movements_inventoryItemId',
  })
  inventoryItem: InventoryItem;

  @Column({ type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'orderId',
    foreignKeyConstraintName: 'FK_inventory_movements_orderId',
  })
  order: Order | null;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_inventory_movements_userId',
  })
  user: User | null;

  // Signed change (+ = restock, - = deduction)
  @Column({ type: 'decimal', precision: 12, scale: 3 })
  delta: number;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  stockAfter: number;

  // e.g. 'restock', 'order_deduction', 'order_refund', 'correction'
  @Column({ type: 'varchar', length: 100, default: 'restock' })
  reason: string;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
