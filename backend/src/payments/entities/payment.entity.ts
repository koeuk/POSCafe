import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { Order } from '../../orders/entities/order.entity';
import { User } from '../../users/entities/user.entity';

@Entity('payments')
@Index('IDX_payments_createdAt', ['createdAt'])
@Index('IDX_payments_refundedAt', ['refundedAt'])
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  // One payment per order (unique constraint managed by @OneToOne).
  @Column({ type: 'int' })
  orderId: number;

  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'orderId',
    foreignKeyConstraintName: 'FK_payments_orderId',
  })
  order: Order;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  // Amount due (order total at time of payment).
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  // Cash given by the customer (equals amount for qr/card).
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  tendered: number;

  // Change returned (0 for qr/card).
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  change: number;

  // Set when an admin refunds this payment (order goes to CANCELLED/REFUNDED).
  @Column({ type: 'datetime', precision: 6, nullable: true })
  refundedAt: Date | null;

  // The admin who issued the refund. Kept when the user is deleted (SET NULL).
  @Column({ type: 'int', nullable: true })
  refundedById: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'refundedById',
    foreignKeyConstraintName: 'FK_payments_refundedById',
  })
  refundedBy: User | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
