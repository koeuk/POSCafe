import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { OrdersService } from '../orders/orders.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly repo: Repository<Payment>,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Records a payment for an order, computes change (for cash), and marks
   * the order completed. One payment per order.
   */
  async create(dto: CreatePaymentDto): Promise<Payment> {
    const order = await this.ordersService.findOne(dto.orderId); // throws if missing

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay for a cancelled order');
    }

    const existing = await this.repo.findOne({
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

    const payment = this.repo.create({
      orderId: order.id,
      method: dto.method,
      amount,
      tendered,
      change,
    });
    const saved = await this.repo.save(payment);

    // Payment received → mark paid, then complete the order (both broadcast).
    await this.ordersService.markPaid(order.id);
    await this.ordersService.updateStatus(order.id, OrderStatus.COMPLETED);

    return saved;
  }

  findByOrder(orderId: number): Promise<Payment | null> {
    return this.repo.findOne({ where: { orderId } });
  }
}
