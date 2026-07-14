import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { roundCents, toNumber } from '../common/money';
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

        // Resolve the base price: from the chosen size if the product has
        // size options, otherwise the product's own price.
        let basePrice = toNumber(product.price);
        let size: string | null = null;
        if (product.sizes && product.sizes.length > 0) {
          if (!line.size) {
            throw new BadRequestException(
              `Size is required for "${product.name}"`,
            );
          }
          const match = product.sizes.find((s) => s.size === line.size);
          if (!match) {
            throw new BadRequestException(
              `Invalid size "${line.size}" for "${product.name}"`,
            );
          }
          basePrice = toNumber(match.price);
          size = match.size;
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

        // Decrement stock. Sized items draw from their per-size variant (the
        // source of truth); products without a variant row fall back to the
        // whole-product stock (covers sizeless products and legacy data).
        const variant = size
          ? await manager.findOne(ProductVariant, {
              where: { productId: product.id, size },
              lock: { mode: 'pessimistic_write' },
            })
          : null;
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
        total,
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
    const order = await this.findOne(id);

    // No-op is fine; otherwise the transition must be allowed.
    if (
      order.status !== status &&
      !OrdersService.STATUS_TRANSITIONS[order.status].includes(status)
    ) {
      throw new BadRequestException(
        `Cannot change order status from "${order.status}" to "${status}"`,
      );
    }

    order.status = status;
    await this.repo.save(order);

    // Broadcast the status change so every screen stays in sync.
    const updated = await this.findOne(id);
    this.gateway.emitOrderUpdated(updated);
    return updated;
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
