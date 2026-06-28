import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
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
export class OrdersService implements OnModuleInit {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly gateway: OrdersGateway,
  ) {}

  // Backfill paymentStatus for orders created before this column existed:
  // any order that already has a payment row is marked paid.
  async onModuleInit() {
    try {
      await this.repo.query(
        `UPDATE orders o SET o.paymentStatus = 'paid'
         WHERE o.paymentStatus <> 'paid'
           AND EXISTS (SELECT 1 FROM payments p WHERE p.orderId = o.id)`,
      );
    } catch {
      // Tables may not exist yet on a fresh database — safe to ignore.
    }
  }

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
        const product = await manager.findOne(Product, {
          where: { id: line.productId },
        });
        if (!product) {
          throw new NotFoundException(`Product #${line.productId} not found`);
        }
        if (!product.isAvailable) {
          throw new BadRequestException(`"${product.name}" is not available`);
        }

        // Resolve the base price: from the chosen size if the product has
        // size options, otherwise the product's own price.
        let basePrice = Number(product.price);
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
          basePrice = Number(match.price);
          size = match.size;
        }

        // Apply the product's discount and snapshot the charged price,
        // rounded to cents so the stored total has no float drift.
        const discount = Math.min(
          Math.max(product.discountPercent ?? 0, 0),
          100,
        );
        const unitPrice =
          Math.round(basePrice * (1 - discount / 100) * 100) / 100;
        const subtotal = Math.round(unitPrice * line.quantity * 100) / 100;
        total += subtotal;

        // Decrement stock. Sized items draw from their per-size variant (the
        // source of truth); products without a variant row fall back to the
        // whole-product stock (covers sizeless products and legacy data).
        const variant = size
          ? await manager.findOne(ProductVariant, {
              where: { productId: product.id, size },
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

      const order = manager.create(Order, {
        orderNumber: `ORD-${Date.now()}`,
        status: OrderStatus.PENDING,
        total,
        userId,
        items, // cascade-inserted
      });
      const saved = await manager.save(order);
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

  async updateStatus(id: number, status: OrderStatus): Promise<Order> {
    const order = await this.findOne(id);
    order.status = status;
    await this.repo.save(order);

    // Broadcast the status change so every screen stays in sync.
    const updated = await this.findOne(id);
    this.gateway.emitOrderUpdated(updated);
    return updated;
  }

  /** Marks an order paid (called when a payment is recorded). */
  async markPaid(id: number): Promise<Order> {
    await this.repo.update(id, { paymentStatus: PaymentStatus.PAID });
    const updated = await this.findOne(id);
    this.gateway.emitOrderUpdated(updated);
    return updated;
  }
}
