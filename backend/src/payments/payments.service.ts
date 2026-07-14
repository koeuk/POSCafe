import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { Order } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly repo: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Records a payment for an order, computes change (for cash), and marks the
   * order paid + completed — all in one transaction that locks the order row,
   * so two concurrent payment requests for the same order can't both succeed
   * and the order can never end up paid-but-not-completed (or vice versa).
   * One payment per order.
   */
  async create(dto: CreatePaymentDto): Promise<Payment> {
    const saved = await this.dataSource.transaction(async (manager) => {
      // Lock the order for the duration of the transaction so a concurrent
      // payment for the same order serializes behind us and sees our insert.
      const order = await manager.findOne(Order, {
        where: { id: dto.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException(`Order #${dto.orderId} not found`);
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot pay for a cancelled order');
      }

      const existing = await manager.findOne(Payment, {
        where: { orderId: dto.orderId },
      });
      if (existing) {
        throw new ConflictException('Order has already been paid');
      }

      const amount = Number(order.total);
      let tendered = amount;
      let change = 0;

      if (dto.method === PaymentMethod.CASH) {
        if (dto.tendered === undefined) {
          throw new BadRequestException('Cash tendered amount is required');
        }
        if (dto.tendered < amount) {
          throw new BadRequestException(
            `Insufficient cash: order is $${amount.toFixed(2)}, received $${dto.tendered.toFixed(2)}`,
          );
        }
        tendered = dto.tendered;
        change = Math.round((tendered - amount) * 100) / 100;
      }

      const payment = manager.create(Payment, {
        orderId: order.id,
        method: dto.method,
        amount,
        tendered,
        change,
      });
      const savedPayment = await manager.save(payment);

      // Paid + completed atomically with the payment insert.
      order.paymentStatus = PaymentStatus.PAID;
      order.status = OrderStatus.COMPLETED;
      await manager.save(order);

      return savedPayment;
    });

    // Broadcast the now-paid, completed order to the kitchen / cashier screens.
    await this.ordersService.broadcastUpdate(dto.orderId);

    return saved;
  }

  findByOrder(orderId: number): Promise<Payment | null> {
    return this.repo.findOne({ where: { orderId } });
  }
}
