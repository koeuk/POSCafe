import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderStatus } from '../common/enums/order-status.enum';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
  ) {}

  /** Today's and all-time completed-order totals. */
  async summary() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const allTime = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'orders')
      .addSelect('COALESCE(SUM(o.total), 0)', 'revenue')
      .where('o.status = :status', { status: OrderStatus.COMPLETED })
      .getRawOne();

    const today = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'orders')
      .addSelect('COALESCE(SUM(o.total), 0)', 'revenue')
      .where('o.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('o.createdAt >= :start', { start: todayStart })
      .getRawOne();

    return {
      today: { orders: Number(today.orders), revenue: Number(today.revenue) },
      allTime: { orders: Number(allTime.orders), revenue: Number(allTime.revenue) },
    };
  }

  /** Revenue + order count per day for the last `days` days (completed orders). */
  async dailySales(days = 7) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select("DATE_FORMAT(o.createdAt, '%Y-%m-%d')", 'date')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('SUM(o.total)', 'revenue')
      .where('o.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('o.createdAt >= :since', { since })
      .groupBy("DATE_FORMAT(o.createdAt, '%Y-%m-%d')")
      .orderBy('date', 'DESC')
      .getRawMany();

    return rows.map((r) => ({
      date: r.date,
      orders: Number(r.orders),
      revenue: Number(r.revenue),
    }));
  }

  /** Top-selling products by quantity (completed orders). */
  async bestProducts(limit = 5) {
    const rows = await this.itemRepo
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .innerJoin('oi.product', 'p')
      .select('p.id', 'productId')
      .addSelect('p.name', 'name')
      .addSelect('SUM(oi.quantity)', 'quantitySold')
      .addSelect('SUM(oi.subtotal)', 'revenue')
      .where('o.status = :status', { status: OrderStatus.COMPLETED })
      .groupBy('p.id')
      .addGroupBy('p.name')
      .orderBy('quantitySold', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r) => ({
      productId: Number(r.productId),
      name: r.name,
      quantitySold: Number(r.quantitySold),
      revenue: Number(r.revenue),
    }));
  }
}
