import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/money';
import { recipeServings } from '../recipes/recipe-servings';

type Aggregate = number | bigint | string | Prisma.Decimal;
interface DailyRow {
  date: string;
  orders: Aggregate;
  revenue: Aggregate;
}
interface CategoryRow {
  categoryId: number;
  name: string;
  quantitySold: Aggregate;
  orders: Aggregate;
  revenue: Aggregate;
}
interface BestProductRow {
  productId: number;
  name: string;
  quantitySold: Aggregate;
  revenue: Aggregate;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stock at product level: counted products report their units on hand,
   * made-to-order products the servings their recipes cover (best size).
   * Lets the report answer "is Blueberry Muffin in stock?" and list every
   * product or size that is sold out.
   */
  async stock() {
    const products = await this.prisma.product.findMany({
      where: { archivedAt: null },
      include: { variants: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    const recipeIds = products
      .filter((p) => p.stockMode === 'recipe')
      .map((p) => p.id);
    const recipes =
      recipeIds.length > 0
        ? await this.prisma.recipe.findMany({
            where: { productId: { in: recipeIds } },
            include: { items: { include: { inventoryItem: true } } },
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

  /** Keep historical drawer totals intact when payments are refunded on a later day. */
  async dayClose(date?: string) {
    const target = date ?? ReportsService.todayString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target))
      throw new BadRequestException('date must be YYYY-MM-DD');
    const taken = Prisma.sql`DATE_FORMAT(p.createdAt, '%Y-%m-%d') = ${target}
      AND (p.refundedAt IS NULL OR DATE_FORMAT(p.refundedAt, '%Y-%m-%d') > ${target})`;
    const methods = await this.prisma.$queryRaw<
      { method: string; count: Aggregate; amount: Aggregate }[]
    >(Prisma.sql`
      SELECT p.method, COUNT(*) AS count, COALESCE(SUM(p.amount), 0) AS amount
      FROM payments p WHERE ${taken} GROUP BY p.method`);
    const byMethod = methods.map((r) => ({
      method: r.method,
      count: Number(r.count),
      amount: Number(r.amount),
    }));
    const cashiers = await this.prisma.$queryRaw<
      { userId: number; name: string; orders: Aggregate; amount: Aggregate }[]
    >(Prisma.sql`
      SELECT o.userId, u.name, COUNT(*) AS orders, COALESCE(SUM(p.amount), 0) AS amount
      FROM payments p JOIN orders o ON o.id = p.orderId JOIN users u ON u.id = o.userId
      WHERE ${taken} GROUP BY o.userId, u.name ORDER BY amount DESC`);
    const byCashier = cashiers.map((r) => ({
      userId: Number(r.userId),
      name: r.name,
      orders: Number(r.orders),
      amount: Number(r.amount),
    }));
    const refunds = await this.prisma.$queryRaw<
      { count: Aggregate; amount: Aggregate }[]
    >`
      SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM payments
      WHERE DATE_FORMAT(refundedAt, '%Y-%m-%d') = ${target}`;
    return {
      date: target,
      totals: {
        payments: byMethod.reduce((s, m) => s + m.count, 0),
        revenue: byMethod.reduce((s, m) => s + m.amount, 0),
      },
      byMethod,
      byCashier,
      refunds: {
        count: Number(refunds[0]?.count ?? 0),
        amount: Number(refunds[0]?.amount ?? 0),
      },
      cashExpected: byMethod.find((m) => m.method === 'cash')?.amount ?? 0,
    };
  }

  private static todayString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  async summary() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [allTime, today] = await Promise.all([
      this.prisma.order.aggregate({
        where: { paymentStatus: 'paid' },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { paymentStatus: 'paid', createdAt: { gte: start } },
        _count: true,
        _sum: { total: true },
      }),
    ]);
    return {
      today: { orders: today._count, revenue: Number(today._sum.total ?? 0) },
      allTime: {
        orders: allTime._count,
        revenue: Number(allTime._sum.total ?? 0),
      },
    };
  }

  async dailySales(days = 7, from?: string, to?: string) {
    let range: Prisma.Sql;
    if (from || to) {
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!from || !to || !dateRe.test(from) || !dateRe.test(to))
        throw new BadRequestException(
          'from and to must both be YYYY-MM-DD dates',
        );
      if (from > to) throw new BadRequestException('from must not be after to');
      range = Prisma.sql`DATE_FORMAT(createdAt, '%Y-%m-%d') BETWEEN ${from} AND ${to}`;
    } else {
      days = Math.min(Math.max(Math.trunc(days), 1), 365);
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (days - 1));
      range = Prisma.sql`createdAt >= ${since}`;
    }
    const rows = await this.prisma.$queryRaw<DailyRow[]>(Prisma.sql`
      SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS date, COUNT(*) AS orders, SUM(total) AS revenue
      FROM orders WHERE paymentStatus = 'paid' AND ${range}
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d') ORDER BY date DESC`);
    return rows.map((r) => ({
      date: r.date,
      orders: Number(r.orders),
      revenue: Number(r.revenue),
    }));
  }

  async categorySales() {
    const rows = await this.prisma.$queryRaw<CategoryRow[]>`
      SELECT c.id AS categoryId, c.name, SUM(oi.quantity) AS quantitySold, COUNT(DISTINCT o.id) AS orders, SUM(oi.subtotal) AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.orderId JOIN products p ON p.id = oi.productId JOIN categories c ON c.id = p.categoryId
      WHERE o.paymentStatus = 'paid' GROUP BY c.id, c.name ORDER BY quantitySold DESC`;
    return rows.map((r) => ({
      categoryId: r.categoryId,
      name: r.name,
      quantitySold: Number(r.quantitySold),
      orders: Number(r.orders),
      revenue: Number(r.revenue),
    }));
  }

  async bestProducts(limit = 5) {
    limit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const rows = await this.prisma.$queryRaw<BestProductRow[]>`
      SELECT p.id AS productId, p.name, SUM(oi.quantity) AS quantitySold, SUM(oi.subtotal) AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.orderId JOIN products p ON p.id = oi.productId
      WHERE o.paymentStatus = 'paid' GROUP BY p.id, p.name ORDER BY quantitySold DESC LIMIT ${limit}`;
    return rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      quantitySold: Number(r.quantitySold),
      revenue: Number(r.revenue),
    }));
  }
}
