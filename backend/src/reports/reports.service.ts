import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
  ) {}

  /**
   * Cup stock by size: how many cups of each size are in stock, and how many
   * size-variants are out of stock. Sized products only (per-size stock lives
   * in product_variants).
   */
  async stock() {
    const bySizeRaw = await this.variantRepo
      .createQueryBuilder('v')
      .select('v.size', 'size')
      .addSelect('SUM(v.stock)', 'inStock')
      .addSelect('COUNT(*)', 'variants')
      .addSelect('SUM(CASE WHEN v.stock <= 0 THEN 1 ELSE 0 END)', 'outOfStock')
      .groupBy('v.size')
      .orderBy('v.size', 'ASC')
      .getRawMany();

    const bySize = bySizeRaw.map((r) => ({
      size: r.size as string,
      inStock: Number(r.inStock),
      variants: Number(r.variants),
      outOfStock: Number(r.outOfStock),
    }));

    const outOfStockItems = await this.variantRepo
      .createQueryBuilder('v')
      .innerJoin('v.product', 'p')
      .select('v.productId', 'productId')
      .addSelect('p.name', 'productName')
      .addSelect('v.size', 'size')
      .where('v.stock <= 0')
      .orderBy('p.name', 'ASC')
      .getRawMany();

    return {
      bySize,
      totals: {
        inStock: bySize.reduce((s, b) => s + b.inStock, 0),
        outOfStock: bySize.reduce((s, b) => s + b.outOfStock, 0),
      },
      outOfStockItems: outOfStockItems.map((r) => ({
        productId: Number(r.productId),
        productName: r.productName as string,
        size: r.size as string,
      })),
    };
  }

  /** Today's and all-time paid-order totals (revenue = money received). */
  async summary() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const allTime = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'orders')
      .addSelect('COALESCE(SUM(o.total), 0)', 'revenue')
      .where('o.paymentStatus = :paid', { paid: PaymentStatus.PAID })
      .getRawOne();

    const today = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'orders')
      .addSelect('COALESCE(SUM(o.total), 0)', 'revenue')
      .where('o.paymentStatus = :paid', { paid: PaymentStatus.PAID })
      .andWhere('o.createdAt >= :start', { start: todayStart })
      .getRawOne();

    return {
      today: { orders: Number(today.orders), revenue: Number(today.revenue) },
      allTime: {
        orders: Number(allTime.orders),
        revenue: Number(allTime.revenue),
      },
    };
  }

  /** Revenue + order count per day for the last `days` days (paid orders). */
  async dailySales(days = 7) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select("DATE_FORMAT(o.createdAt, '%Y-%m-%d')", 'date')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('SUM(o.total)', 'revenue')
      .where('o.paymentStatus = :paid', { paid: PaymentStatus.PAID })
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

  /**
   * Sales per category (paid orders), most popular first. Used by the
   * dashboard "Popular Categories" chart.
   */
  async categorySales() {
    const rows = await this.itemRepo
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .innerJoin('oi.product', 'p')
      .innerJoin('p.category', 'c')
      .select('c.id', 'categoryId')
      .addSelect('c.name', 'name')
      .addSelect('SUM(oi.quantity)', 'quantitySold')
      .addSelect('COUNT(DISTINCT o.id)', 'orders')
      .addSelect('SUM(oi.subtotal)', 'revenue')
      .where('o.paymentStatus = :paid', { paid: PaymentStatus.PAID })
      .groupBy('c.id')
      .addGroupBy('c.name')
      .orderBy('quantitySold', 'DESC')
      .getRawMany();

    return rows.map((r) => ({
      categoryId: Number(r.categoryId),
      name: r.name as string,
      quantitySold: Number(r.quantitySold),
      orders: Number(r.orders),
      revenue: Number(r.revenue),
    }));
  }

  /** Top-selling products by quantity (paid orders). */
  async bestProducts(limit = 5) {
    const rows = await this.itemRepo
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .innerJoin('oi.product', 'p')
      .select('p.id', 'productId')
      .addSelect('p.name', 'name')
      .addSelect('SUM(oi.quantity)', 'quantitySold')
      .addSelect('SUM(oi.subtotal)', 'revenue')
      .where('o.paymentStatus = :paid', { paid: PaymentStatus.PAID })
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
