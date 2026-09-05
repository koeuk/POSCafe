import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  Repository,
  type ObjectLiteral,
  type SelectQueryBuilder,
  IsNull,
} from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { toNumber } from '../common/money';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Product } from '../products/entities/product.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import { recipeServings } from '../recipes/recipe-servings';
import { User } from '../users/entities/user.entity';

// Raw aggregate rows (MySQL returns COUNT/SUM as strings; toNumber coerces).
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
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  /** Restricts a query on order alias `o` to paid orders. */
  private paidOnly<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
  ): SelectQueryBuilder<T> {
    return qb.where('o.paymentStatus = :paid', { paid: PaymentStatus.PAID });
  }

  /**
   * Stock at product level: counted products report their units on hand,
   * made-to-order products the servings their recipes cover (best size).
   * Lets the report answer "is Blueberry Muffin in stock?" and list every
   * product or size that is sold out.
   */
  async stock() {
    const products = await this.productRepo.find({
      where: { archivedAt: IsNull() },
      relations: { variants: true },
      order: { name: 'ASC', variants: { sortOrder: 'ASC' } },
    });
    const recipeIds = products
      .filter((p) => p.stockMode === 'recipe')
      .map((p) => p.id);
    const recipes =
      recipeIds.length > 0
        ? await this.recipeRepo.find({
            where: { productId: In(recipeIds) },
            relations: { items: { inventoryItem: true } },
          })
        : [];
    const servingsFor = (productId: number, size: string | null) => {
      const exact = size
        ? recipes.find((r) => r.productId === productId && r.size === size)
        : undefined;
      const recipe =
        exact ??
        recipes.find((r) => r.productId === productId && r.size === null);
      return recipe ? recipeServings(recipe) : 0;
    };

    const byProduct: {
      productId: number;
      productName: string;
      stockMode: string;
      inStock: number;
    }[] = [];
    const outOfStockItems: {
      productId: number;
      productName: string;
      size: string | null;
    }[] = [];

    for (const p of products) {
      if (p.stockMode === 'recipe') {
        const sizes: (string | null)[] =
          p.variants.length > 0 ? p.variants.map((v) => v.size) : [null];
        let best = 0;
        for (const size of sizes) {
          const servings = servingsFor(p.id, size);
          best = Math.max(best, servings);
          if (servings <= 0) {
            outOfStockItems.push({
              productId: p.id,
              productName: p.name,
              size,
            });
          }
        }
        byProduct.push({
          productId: p.id,
          productName: p.name,
          stockMode: p.stockMode,
          inStock: best,
        });
      } else {
        byProduct.push({
          productId: p.id,
          productName: p.name,
          stockMode: p.stockMode,
          inStock: p.stock,
        });
        if (p.stock <= 0) {
          outOfStockItems.push({
            productId: p.id,
            productName: p.name,
            size: null,
          });
        }
      }
    }

    return {
      byProduct,
      totals: {
        inStock: byProduct.reduce((s, p) => s + p.inStock, 0),
        outOfStock: byProduct.filter((p) => p.inStock <= 0).length,
      },
      outOfStockItems,
    };
  }

  /**
   * End-of-day close ("Z report") for one date (server timezone, default
   * today): payments taken that day by method and by cashier, plus refunds
   * issued that day. Same-day-refunded payments are excluded from the method
   * totals so "cash expected in drawer" matches what is actually in the till.
   */
  async dayClose(date?: string) {
    const target = date ?? ReportsService.todayString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }

    // Payments taken on the target day, excluding those refunded *that same
    // day* — a same-day refund never reached the till, so it must not appear
    // in the cash expected in the drawer.
    //
    // A refund issued on a LATER day must NOT retroactively remove the payment
    // here: the money genuinely was in Monday's drawer and was counted against
    // Monday's physical cash-up. Filtering on `refundedAt IS NULL` alone would
    // rewrite an already-closed day every time an old order is refunded, and
    // the same amount would be deducted twice — once by vanishing from its own
    // day, and again in the refunds bucket of the day it was refunded on.
    const takenQb = () =>
      this.paymentRepo
        .createQueryBuilder('p')
        .where("DATE_FORMAT(p.createdAt, '%Y-%m-%d') = :d", { d: target })
        .andWhere(
          "(p.refundedAt IS NULL OR DATE_FORMAT(p.refundedAt, '%Y-%m-%d') > :d)",
          { d: target },
        );

    const byMethodRaw = await takenQb()
      .select('p.method', 'method')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'amount')
      .groupBy('p.method')
      .getRawMany<{ method: string; count: string; amount: string }>();
    const byMethod = byMethodRaw.map((r) => ({
      method: r.method,
      count: toNumber(r.count),
      amount: toNumber(r.amount),
    }));

    const byCashierRaw = await takenQb()
      .innerJoin(Order, 'o', 'o.id = p.orderId')
      .innerJoin(User, 'u', 'u.id = o.userId')
      .select('o.userId', 'userId')
      .addSelect('u.name', 'name')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'amount')
      .groupBy('o.userId')
      .addGroupBy('u.name')
      .orderBy('amount', 'DESC')
      .getRawMany<{
        userId: number;
        name: string;
        orders: string;
        amount: string;
      }>();
    const byCashier = byCashierRaw.map((r) => ({
      userId: Number(r.userId),
      name: r.name,
      orders: toNumber(r.orders),
      amount: toNumber(r.amount),
    }));

    // Refunds issued on the target day (whenever the payment was taken).
    const refundsRaw = await this.paymentRepo
      .createQueryBuilder('p')
      .where("DATE_FORMAT(p.refundedAt, '%Y-%m-%d') = :d", { d: target })
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'amount')
      .getRawOne<{ count: string; amount: string }>();

    const totalRevenue = byMethod.reduce((s, m) => s + m.amount, 0);
    const cashExpected = byMethod.find((m) => m.method === 'cash')?.amount ?? 0;

    return {
      date: target,
      totals: {
        payments: byMethod.reduce((s, m) => s + m.count, 0),
        revenue: totalRevenue,
      },
      byMethod,
      byCashier,
      refunds: {
        count: toNumber(refundsRaw?.count ?? 0),
        amount: toNumber(refundsRaw?.amount ?? 0),
      },
      cashExpected,
    };
  }

  /** Today's date as YYYY-MM-DD in the server's timezone. */
  private static todayString(): string {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${mm}-${dd}`;
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

  /**
   * Revenue + order count per day (paid orders). Either the last `days` days,
   * or an explicit `from`–`to` date range (YYYY-MM-DD, inclusive, server tz).
   */
  async dailySales(days = 7, from?: string, to?: string) {
    const qb = this.paidOnly(
      this.orderRepo
        .createQueryBuilder('o')
        .select("DATE_FORMAT(o.createdAt, '%Y-%m-%d')", 'date')
        .addSelect('COUNT(*)', 'orders')
        .addSelect('SUM(o.total)', 'revenue'),
    );

    if (from || to) {
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!from || !to || !dateRe.test(from) || !dateRe.test(to)) {
        throw new BadRequestException(
          'from and to must both be YYYY-MM-DD dates',
        );
      }
      if (from > to) {
        throw new BadRequestException('from must not be after to');
      }
      qb.andWhere(
        "DATE_FORMAT(o.createdAt, '%Y-%m-%d') BETWEEN :from AND :to",
        {
          from,
          to,
        },
      );
    } else {
      days = Math.min(Math.max(Math.trunc(days), 1), 365);
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (days - 1));
      qb.andWhere('o.createdAt >= :since', { since });
    }

    const rows = await qb
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
