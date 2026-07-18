import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  type ObjectLiteral,
  type SelectQueryBuilder,
} from 'typeorm';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { toNumber } from '../common/money';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';

// Raw aggregate rows (MySQL returns COUNT/SUM as strings; toNumber coerces).
interface StockBySizeRow {
  size: string;
  inStock: string;
  variants: string;
  outOfStock: string;
}
interface OutOfStockRow {
  productId: number;
  productName: string;
  size: string;
}
interface TotalsRow {
  orders: string;
  revenue: string;
}
interface DailyRow {
  date: string;
  orders: string;
  revenue: string;
}
interface CategoryRow {
  categoryId: number;
  name: string;
  quantitySold: string;
  orders: string;
  revenue: string;
}
interface BestProductRow {
  productId: number;
  name: string;
  quantitySold: string;
  revenue: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  // Label for the stock-report group covering products that have no sizes.
  private static readonly UNSIZED_LABEL = 'No size';

  /** Restricts a query on order alias `o` to paid orders. */
  private paidOnly<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
  ): SelectQueryBuilder<T> {
    return qb.where('o.paymentStatus = :paid', { paid: PaymentStatus.PAID });
  }

  /**
   * Cup stock by size: how many cups of each size are in stock, and how many
   * size-variants are out of stock. Sized products draw from product_variants;
   * products with no variant rows keep their stock on the product itself and
   * are reported under a single UNSIZED_LABEL group, so the totals cover the
   * whole catalogue rather than just sized items.
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
      .getRawMany<StockBySizeRow>();

    const bySize = bySizeRaw.map((r) => ({
      size: r.size,
      inStock: toNumber(r.inStock),
      variants: toNumber(r.variants),
      outOfStock: toNumber(r.outOfStock),
    }));

    // Products with no variant rows: stock lives on the product itself.
    const unsizedQb = () =>
      this.productRepo.createQueryBuilder('p').where((qb) => {
        const sub = qb
          .subQuery()
          .select('1')
          .from(ProductVariant, 'v')
          .where('v.productId = p.id')
          .getQuery();
        return `NOT EXISTS ${sub}`;
      });

    const unsizedRaw = await unsizedQb()
      .select('COALESCE(SUM(p.stock), 0)', 'inStock')
      .addSelect('COUNT(*)', 'variants')
      .addSelect('SUM(CASE WHEN p.stock <= 0 THEN 1 ELSE 0 END)', 'outOfStock')
      .getRawOne<Omit<StockBySizeRow, 'size'>>();

    const unsized = {
      size: ReportsService.UNSIZED_LABEL,
      inStock: toNumber(unsizedRaw?.inStock ?? 0),
      variants: toNumber(unsizedRaw?.variants ?? 0),
      outOfStock: toNumber(unsizedRaw?.outOfStock ?? 0),
    };
    // Only surface the group when there are sizeless products at all.
    const groups = unsized.variants > 0 ? [...bySize, unsized] : bySize;

    const outOfStockVariants = await this.variantRepo
      .createQueryBuilder('v')
      .innerJoin('v.product', 'p')
      .select('v.productId', 'productId')
      .addSelect('p.name', 'productName')
      .addSelect('v.size', 'size')
      .where('v.stock <= 0')
      .orderBy('p.name', 'ASC')
      .getRawMany<OutOfStockRow>();

    const outOfStockUnsized = await unsizedQb()
      .andWhere('p.stock <= 0')
      .select('p.id', 'productId')
      .addSelect('p.name', 'productName')
      .orderBy('p.name', 'ASC')
      .getRawMany<Omit<OutOfStockRow, 'size'>>();

    return {
      bySize: groups,
      totals: {
        inStock: groups.reduce((s, b) => s + b.inStock, 0),
        outOfStock: groups.reduce((s, b) => s + b.outOfStock, 0),
      },
      outOfStockItems: [
        ...outOfStockVariants.map((r) => ({
          productId: r.productId,
          productName: r.productName,
          size: r.size,
        })),
        ...outOfStockUnsized.map((r) => ({
          productId: r.productId,
          productName: r.productName,
          size: ReportsService.UNSIZED_LABEL,
        })),
      ].sort((a, b) => a.productName.localeCompare(b.productName)),
    };
  }

  /** Today's and all-time paid-order totals (revenue = money received). */
  async summary() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const totalsQb = () =>
      this.orderRepo
        .createQueryBuilder('o')
        .select('COUNT(*)', 'orders')
        .addSelect('COALESCE(SUM(o.total), 0)', 'revenue')
        .where('o.paymentStatus = :paid', { paid: PaymentStatus.PAID });

    const allTime = await totalsQb().getRawOne<TotalsRow>();
    const today = await totalsQb()
      .andWhere('o.createdAt >= :start', { start: todayStart })
      .getRawOne<TotalsRow>();

    return {
      today: {
        orders: toNumber(today?.orders ?? 0),
        revenue: toNumber(today?.revenue ?? 0),
      },
      allTime: {
        orders: toNumber(allTime?.orders ?? 0),
        revenue: toNumber(allTime?.revenue ?? 0),
      },
    };
  }

  /** Revenue + order count per day for the last `days` days (paid orders). */
  async dailySales(days = 7) {
    days = Math.min(Math.max(Math.trunc(days), 1), 365);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const rows = await this.paidOnly(
      this.orderRepo
        .createQueryBuilder('o')
        .select("DATE_FORMAT(o.createdAt, '%Y-%m-%d')", 'date')
        .addSelect('COUNT(*)', 'orders')
        .addSelect('SUM(o.total)', 'revenue'),
    )
      .andWhere('o.createdAt >= :since', { since })
      .groupBy("DATE_FORMAT(o.createdAt, '%Y-%m-%d')")
      .orderBy('date', 'DESC')
      .getRawMany<DailyRow>();

    return rows.map((r) => ({
      date: r.date,
      orders: toNumber(r.orders),
      revenue: toNumber(r.revenue),
    }));
  }

  /**
   * Sales per category (paid orders), most popular first. Used by the
   * dashboard "Popular Categories" chart.
   */
  async categorySales() {
    const rows = await this.paidOnly(
      this.itemRepo
        .createQueryBuilder('oi')
        .innerJoin('oi.order', 'o')
        .innerJoin('oi.product', 'p')
        .innerJoin('p.category', 'c')
        .select('c.id', 'categoryId')
        .addSelect('c.name', 'name')
        .addSelect('SUM(oi.quantity)', 'quantitySold')
        .addSelect('COUNT(DISTINCT o.id)', 'orders')
        .addSelect('SUM(oi.subtotal)', 'revenue'),
    )
      .groupBy('c.id')
      .addGroupBy('c.name')
      .orderBy('quantitySold', 'DESC')
      .getRawMany<CategoryRow>();

    return rows.map((r) => ({
      categoryId: r.categoryId,
      name: r.name,
      quantitySold: toNumber(r.quantitySold),
      orders: toNumber(r.orders),
      revenue: toNumber(r.revenue),
    }));
  }

  /** Top-selling products by quantity (paid orders). */
  async bestProducts(limit = 5) {
    limit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const rows = await this.paidOnly(
      this.itemRepo
        .createQueryBuilder('oi')
        .innerJoin('oi.order', 'o')
        .innerJoin('oi.product', 'p')
        .select('p.id', 'productId')
        .addSelect('p.name', 'name')
        .addSelect('SUM(oi.quantity)', 'quantitySold')
        .addSelect('SUM(oi.subtotal)', 'revenue'),
    )
      .groupBy('p.id')
      .addGroupBy('p.name')
      .orderBy('quantitySold', 'DESC')
      .limit(limit)
      .getRawMany<BestProductRow>();

    return rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      quantitySold: toNumber(r.quantitySold),
      revenue: toNumber(r.revenue),
    }));
  }
}
