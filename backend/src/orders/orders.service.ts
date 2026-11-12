import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { lockProduct, lockOrder } from '../prisma/locks';
import type { OrderWithDetails } from '../prisma/models';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { roundCents, toNumber } from '../common/money';
import {
  OrderStockDeduction,
  reverseOrderStock,
} from '../inventory/order-stock.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersGateway } from './orders.gateway';

export interface FindOrdersFilter {
  status?: OrderStatus;
  userId?: number;
  // Only orders that have no payment yet (and aren't cancelled).
  unpaid?: boolean;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OrdersGateway,
  ) {}

  /**
   * Creates an order atomically: validates each product, snapshots prices,
   * decrements stock, and computes the total — all in one transaction so
   * concurrent orders can't oversell.
   */
  async create(userId: number, dto: CreateOrderDto): Promise<OrderWithDetails> {
    const orderId = await this.prisma.$transaction(async (manager) => {
      let total = 0;
      const items: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] = [];
      const deduction = new OrderStockDeduction(manager);
      for (const id of [
        ...new Set(dto.items.map((line) => line.productId)),
      ].sort((a, b) => a - b)) {
        await lockProduct(manager, id);
      }

      for (const line of dto.items) {
        // Lock the product row for the duration of the transaction so two
        // concurrent orders can't both read the same stock and oversell.
        const product = await lockProduct(manager, line.productId);
        if (!product) {
          throw new NotFoundException(`Product #${line.productId} not found`);
        }
        if (!product.isAvailable || product.archivedAt) {
          throw new BadRequestException(`"${product.name}" is not available`);
        }

        // A product is "sized" when it has variant rows — each carries its
        // own price. Sizeless products price from the product row itself.
        const hasSizes =
          (await manager.productVariant.count({
            where: { productId: product.id },
          })) > 0;

        let basePrice = toNumber(product.price);
        let size: string | null = null;

        if (hasSizes) {
          if (!line.size) {
            throw new BadRequestException(
              `Size is required for "${product.name}"`,
            );
          }
          const variant = await manager.productVariant.findFirst({
            where: { productId: product.id, size: line.size },
          });
          if (!variant) {
            throw new BadRequestException(
              `Invalid size "${line.size}" for "${product.name}"`,
            );
          }
          basePrice = toNumber(variant.price);
          size = variant.size;
        }

        // Apply the product's discount and snapshot the charged price,
        // rounded to cents so the stored total has no float drift.
        const discount = Math.min(
          Math.max(product.discountPercent ?? 0, 0),
          100,
        );
        const unitPrice = roundCents(basePrice * (1 - discount / 100));
        const subtotal = roundCents(unitPrice * line.quantity);
        total += subtotal;

        // Take the units from exactly one place, per the product's stock
        // mode: counted products are decremented here; a made-to-order
        // product's ingredients are deducted once the order row exists so the
        // movements can carry its id.
        const { stockSource, extras } = await deduction.reserveLine({
          product,
          size,
          quantity: line.quantity,
          extras: line.extras,
        });

        items.push({
          productId: product.id,
          quantity: line.quantity,
          size,
          note: line.note?.trim() || null,
          extras:
            extras === null
              ? Prisma.DbNull
              : extras.map((extra) => ({ ...extra })),
          unitPrice,
          subtotal,
          stockSource,
        });
      }

      // Derive the order number from the auto-increment id so it's always
      // unique — a timestamp collides when two orders are created in the same
      // millisecond and trips the unique constraint. Insert with a temporary
      // placeholder first, then set the final number once the id is known.
      const saved = await manager.order.create({
        data: {
          orderNumber: `TMP-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
          status: OrderStatus.PENDING,
          total: roundCents(total),
          userId,
          items: { create: items },
        },
      });
      await manager.order.update({
        where: { id: saved.id },
        data: {
          orderNumber: `ORD-${String(saved.id).padStart(6, '0')}`,
        },
      });

      // Consumables last: any shortfall throws and rolls the whole order back.
      await deduction.commitIngredients(saved.id, userId);
      return saved.id;
    });

    // Return the fully-populated order (with items + product details),
    // and broadcast it live to the Orders queue on every screen.
    const order = await this.findOne(orderId);
    this.gateway.emitOrderCreated(order);
    return order;
  }

  findAll(filter: FindOrdersFilter = {}): Promise<OrderWithDetails[]> {
    const where: Prisma.OrderWhereInput = {};
    if (filter.status !== undefined) where.status = filter.status;
    if (filter.userId !== undefined) where.userId = filter.userId;
    if (filter.unpaid) {
      where.AND = [
        { status: { not: OrderStatus.CANCELLED } },
        { paymentStatus: PaymentStatus.UNPAID },
      ];
    }
    return this.prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true } },
        user: { omit: { password: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number): Promise<OrderWithDetails> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        user: { omit: { password: true } },
      },
    });
    if (!order) throw new NotFoundException(`Order #${id} not found`);
    return order;
  }

  // Legal fulfilment-status transitions. COMPLETED and CANCELLED are terminal.
  // Every active state may jump straight to COMPLETED (payment completes the
  // order from wherever it is) or CANCELLED.
  private static readonly STATUS_TRANSITIONS: Record<
    OrderStatus,
    OrderStatus[]
  > = {
    [OrderStatus.PENDING]: [
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.PREPARING]: [
      OrderStatus.READY,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  async updateStatus(
    id: number,
    status: OrderStatus,
    userId: number | null = null,
  ): Promise<OrderWithDetails> {
    await this.prisma.$transaction(async (manager) => {
      // Lock the order row for the whole transaction. Without this, a status
      // change racing a payment does a read-modify-write over the payment's
      // committed status and can leave the order CANCELLED but PAID.
      // Locked without relations — a pessimistic lock over a join would also
      // lock the joined item rows, which isn't what we want here.
      const order = await lockOrder(manager, id);
      if (!order) {
        throw new NotFoundException(`Order #${id} not found`);
      }

      // No-op is fine; otherwise the transition must be allowed.
      if (order.status === status) {
        return;
      }
      if (!OrdersService.STATUS_TRANSITIONS[order.status].includes(status)) {
        throw new BadRequestException(
          `Cannot change order status from "${order.status}" to "${status}"`,
        );
      }

      // A paid order has money against it; cancelling would strand that
      // payment and still count it as revenue — an admin must refund instead.
      if (
        status === OrderStatus.CANCELLED &&
        order.paymentStatus === PaymentStatus.PAID
      ) {
        throw new BadRequestException(
          'This order has been paid — refund it instead of cancelling',
        );
      }

      // COMPLETED is terminal and stock was decremented at creation, so
      // completing an unpaid order strands the cups: they can never be
      // reclaimed (no transition out of COMPLETED) and the sale never reaches
      // revenue, which only counts paymentStatus = PAID. That is an
      // unauditable way to give away inventory, so payment has to come first —
      // payments.service marks the order COMPLETED itself once money lands.
      if (
        status === OrderStatus.COMPLETED &&
        order.paymentStatus !== PaymentStatus.PAID
      ) {
        throw new BadRequestException(
          'Take payment before completing this order (or cancel it to return the stock)',
        );
      }

      // Cancelling returns everything the sale took: stock-counted units and
      // recipe consumables alike. `create()` deducts up front, so without
      // this the units are lost for good.
      if (status === OrderStatus.CANCELLED) {
        await reverseOrderStock(manager, order.id, userId);
      }

      await manager.order.update({ where: { id }, data: { status } });
    });

    // Broadcast the status change so every screen stays in sync.
    const updated = await this.findOne(id);
    this.gateway.emitOrderUpdated(updated);
    return updated;
  }

  /**
   * Refunds a paid order (admin only): marks the payment refunded, cancels
   * the order and returns its items to stock — atomically. Refunded orders
   * drop out of revenue because reports only count paymentStatus = PAID.
   */
  async refund(id: number, adminUserId: number): Promise<OrderWithDetails> {
    await this.prisma.$transaction(async (manager) => {
      const order = await lockOrder(manager, id);
      if (!order) {
        throw new NotFoundException(`Order #${id} not found`);
      }
      if (order.paymentStatus !== PaymentStatus.PAID) {
        throw new BadRequestException(
          order.paymentStatus === PaymentStatus.REFUNDED
            ? 'This order has already been refunded'
            : 'Only paid orders can be refunded',
        );
      }

      const payment = await manager.payment.findUnique({
        where: { orderId: order.id },
      });
      if (payment) {
        await manager.payment.update({
          where: { id: payment.id },
          data: { refundedAt: new Date(), refundedById: adminUserId },
        });
      }

      // Return the units to inventory unless the order was already cancelled
      // (not reachable today — cancel blocks paid orders — but kept as a
      // guard against double restock).
      if (order.status !== OrderStatus.CANCELLED) {
        await reverseOrderStock(manager, order.id, adminUserId);
      }

      await manager.order.update({
        where: { id },
        data: {
          paymentStatus: PaymentStatus.REFUNDED,
          status: OrderStatus.CANCELLED,
        },
      });
    });

    const updated = await this.findOne(id);
    this.gateway.emitOrderUpdated(updated);
    return updated;
  }

  /**
   * Reloads an order and broadcasts it to all screens. Used by other services
   * (e.g. payments) that mutate an order inside their own transaction and just
   * need the live update pushed out after the commit.
   */
  async broadcastUpdate(id: number): Promise<OrderWithDetails> {
    const order = await this.findOne(id);
    this.gateway.emitOrderUpdated(order);
    return order;
  }
}
