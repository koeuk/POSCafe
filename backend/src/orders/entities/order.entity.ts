import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { User } from '../../users/entities/user.entity';
import { OrderItem } from './order-item.entity';

@Entity('orders')
@Index('UQ_orders_orderNumber', ['orderNumber'], { unique: true })
@Index('IDX_orders_userId_createdAt', ['userId', 'createdAt'])
@Index('IDX_orders_status_createdAt', ['status', 'createdAt'])
@Index('IDX_orders_paymentStatus_createdAt', ['paymentStatus', 'createdAt'])
@Index('IDX_orders_createdAt', ['createdAt'])
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  // The cashier who created the order.
  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_orders_userId' })
  user: User;

  @Column({ type: 'varchar', length: 64 })
  orderNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  // Payment state, tracked separately from the fulfilment status above.
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus: PaymentStatus;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
