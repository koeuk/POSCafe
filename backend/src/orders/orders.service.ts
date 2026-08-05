import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { roundCents, toNumber } from '../common/money';
import { Payment } from '../payments/entities/payment.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
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
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly gateway: OrdersGateway,
  ) {}

  /**
   * Creates an order atomically: validates each product, snapshots prices,
   * decrements stock, and computes the total — all in one transaction so
   * concurrent orders can't oversell.
   */
  async create(userId: number, dto: CreateOrderDto): Promise<Order> {
    const orderId = await this.dataSource.transaction(async (manager) => {
      let total = 0;
      const items: OrderItem[] = [];

      for (const line of dto.items) {
        // Lock the product row for the duration of the transaction so two
        // concurrent orders can't both read the same stock and oversell.
        const product = await manager.findOne(Product, {
          where: { id: line.productId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!product) {
          throw new NotFoundException(`Product #${line.productId} not found`);
        }
        if (!product.isAvailable) {
          throw new BadRequestException(`"${product.name}" is not available`);
        }

        // A product is "sized" when it has variant rows — each carries its
        // own price and stock. Sizeless products price and stock from the
        // product row itself.
        const hasSizes =
          (await manager.count(ProductVariant, {
            where: { productId: product.id },
          })) > 0;

        let basePrice = toNumber(product.price);
        let size: string | null = null;
        let variant: ProductVariant | null = null;
        if (hasSizes) {
          if (!line.size) {
            throw new BadRequestException(
              `Size is required for "${product.name}"`,
            );
          }
          // Lock the chosen variant row so concurrent orders can't oversell.
          variant = await manager.findOne(ProductVariant, {
            where: { productId: product.id, size: line.size },
            lock: { mode: 'pessimistic_write' },
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

        // Decrement stock: sized items draw from their variant, sizeless
        // products from the whole-product stock.
        if (variant) {
          if (variant.stock < line.quantity) {
            throw new BadRequestException(
              `Insufficient stock for "${product.name}" (${size}): have ${variant.stock}, need ${line.quantity}`,
            );
          }
          variant.stock -= line.quantity;
          await manager.save(variant);
        } else {
          if (product.stock < line.quantity) {
            throw new BadRequestException(
              `Insufficient stock for "${product.name}" (have ${product.stock}, need ${line.quantity})`,
            );
          }
          product.stock -= line.quantity;
          await manager.save(product);
        }

        items.push(
          manager.create(OrderItem, {
            productId: product.id,
            quantity: line.quantity,
            size,
            unitPrice,
            subtotal,
          }),
        );
      }

      // Derive the order number from the auto-increment id so it's always
      // unique — a timestamp collides when two orders are created in the same
      // millisecond and trips the unique constraint. Insert with a temporary
      // placeholder first, then set the final number once the id is known.
      const order = manager.create(Order, {
        orderNumber: `TMP-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
        status: OrderStatus.PENDING,
        total: roundCents(total),
        userId,
        items, // cascade-inserted
      });
      const saved = await manager.save(order);
      saved.orderNumber = `ORD-${String(saved.id).padStart(6, '0')}`;
      await manager.save(saved);
      return saved.id;
    });

    // Return the fully-populated order (with items + product details),
    // and broadcast it live to the kitchen / barista screens.
    const order = await this.findOne(orderId);
    this.gateway.emitOrderCreated(order);
    return order;
  }

  findAll(filter: FindOrdersFilter = {}): Promise<Order[]> {
    // Unpaid orders: no payment row yet, and not cancelled. Used by the
    // "Take Payment" screen so paid/cancelled orders never show up there.
    if (filter.unpaid) {
      const qb = this.repo
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('o.user', 'user')
        .where('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
        .andWhere('o.paymentStatus = :unpaid', {
          unpaid: PaymentStatus.UNPAID,
        })
        .orderBy('o.createdAt', 'DESC');
      if (filter.status !== undefined) {
        qb.andWhere('o.status = :status', { status: filter.status });
      }
      if (filter.userId !== undefined) {
        qb.andWhere('o.userId = :userId', { userId: filter.userId });
      }
      return qb.getMany();
    }

    // Build the where clause with only defined keys — TypeORM throws on
    // undefined values in a where condition.
    const where: { status?: OrderStatus; userId?: number } = {};
    if (filter.status !== undefined) {
      where.status = filter.status;
    }
    if (filter.userId !== undefined) {
      where.userId = filter.userId;
    }

    return this.repo.find({
      where,
      relations: { items: { product: true }, user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.repo.findOne({
      where: { id },
      relations: { items: { product: true }, user: true },
    });
    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }
    return order;
  }

  // Legal kitchen-status transitions. COMPLETED and CANCELLED are terminal.
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

  async updateStatus(id: number, status: OrderStatus): Promise<Order> {
    await this.dataSource.transaction(async (manager) => {
      // Lock the order row for the whole transaction. Without this, a status
      // change racing a payment does a read-modify-write over the payment's
      // committed status and can leave the order CANCELLED but PAID.
      // Locked without relations — a pessimistic lock over a join would also
      // lock the joined item rows, which isn't what we want here.
      const order = await manager.findOne(Order, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
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

      // Cancelling returns the reserved cups to inventory. `create()` decrements
      // stock up front, so without this the units are lost for good.
      if (status === OrderStatus.CANCELLED) {
        const items = await manager.find(OrderItem, {
          where: { orderId: order.id },
        });
        await this.restockItems(manager, items);
      }

      order.status = status;
      await manager.save(order);
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
  async refund(id: number, adminUserId: number): Promise<Order> {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
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

      const payment = await manager.findOne(Payment, {
        where: { orderId: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (payment) {
        payment.refundedAt = new Date();
        payment.refundedById = adminUserId;
        await manager.save(payment);
      }

      // Return the units to inventory unless the order was already cancelled
      // (not reachable today — cancel blocks paid orders — but kept as a
      // guard against double restock).
      if (order.status !== OrderStatus.CANCELLED) {
        const items = await manager.find(OrderItem, {
          where: { orderId: order.id },
        });
        await this.restockItems(manager, items);
      }

      order.paymentStatus = PaymentStatus.REFUNDED;
      order.status = OrderStatus.CANCELLED;
      await manager.save(order);
    });

    const updated = await this.findOne(id);
    this.gateway.emitOrderUpdated(updated);
    return updated;
  }

  /**
   * Returns an order's items to stock, mirroring the decrement in `create()`:
   * sized items go back to their per-size variant, everything else to the
   * whole-product stock. Runs inside the caller's transaction.
   */
  private async restockItems(
    manager: EntityManager,
    items: OrderItem[],
  ): Promise<void> {
    for (const item of items) {
      const variant = item.size
        ? await manager.findOne(ProductVariant, {
            where: { productId: item.productId, size: item.size },
            lock: { mode: 'pessimistic_write' },
          })
        : null;

      if (variant) {
        variant.stock += item.quantity;
        await manager.save(variant);
        continue;
      }

      const product = await manager.findOne(Product, {
        where: { id: item.productId },
        lock: { mode: 'pessimistic_write' },
      });
      // The product may have been deleted since the order was placed — there
      // is nothing to restock, and that shouldn't block the cancellation.
      if (product) {
        product.stock += item.quantity;
        await manager.save(product);
      }
    }
  }

  /**
   * Reloads an order and broadcasts it to all screens. Used by other services
   * (e.g. payments) that mutate an order inside their own transaction and just
   * need the live update pushed out after the commit.
   */
  async broadcastUpdate(id: number): Promise<Order> {
    const order = await this.findOne(id);
    this.gateway.emitOrderUpdated(order);
    return order;
  }
}
