import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  productId: number;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  quantity: number;

  // Chosen size (e.g. S/M/L), null for items without size options.
  @Column({ type: 'varchar', length: 255, nullable: true })
  size: string | null;

  // Free-text preparation note from the cashier ("less sugar, no ice").
  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  // Where the units came from at sale time: 'recipe' (consumables were
  // deducted via the product's recipe) or 'stock' (the product's own stock
  // count). Cancel/refund reverses exactly this — see order-stock.service.
  @Column({ type: 'varchar', length: 10, default: 'stock' })
  stockSource: 'recipe' | 'stock';

  // Price snapshot at order time (product price may change later).
  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;
}
