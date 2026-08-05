import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { Order } from '../../orders/entities/order.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  // One payment per order.
  @Column({ unique: true })
  orderId: number;

  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  // Amount due (order total at time of payment).
  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  // Cash given by the customer (equals amount for qr/card).
  @Column('decimal', { precision: 10, scale: 2 })
  tendered: number;

  // Change returned (0 for qr/card).
  @Column('decimal', { precision: 10, scale: 2 })
  change: number;

  // Set when an admin refunds this payment (order goes to CANCELLED/REFUNDED).
  @Column({ type: 'datetime', nullable: true })
  refundedAt: Date | null;

  // The admin who issued the refund.
  @Column({ type: 'int', nullable: true })
  refundedById: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
