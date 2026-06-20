import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { OrderStatus } from '../common/enums/order-status.enum';
import { OrderType } from '../common/enums/order-type.enum';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrdersGateway } from './orders.gateway';

export interface FindOrdersFilter {
  status?: OrderStatus;
  userId?: number;
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
        const discount = Math.min(Math.max(product.discountPercent ?? 0, 0), 100);
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
        orderType: dto.orderType ?? OrderType.DINE_IN,
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
    // Build the where clause with only defined keys — TypeORM throws on
    // undefined values in a where condition.
    const where: FindOrdersFilter = {};
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

  /**
   * Cashier "today" snapshot: order/item counts, revenue, and cups by size.
   * Excludes cancelled orders.
   */
  async getTodaySummary() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const orders = await this.repo.find({
      where: {
        createdAt: MoreThanOrEqual(start),
        status: Not(OrderStatus.CANCELLED),
      },
      relations: { items: true },
    });

    let items = 0;
    let revenue = 0;
    const cupsBySize: Record<string, number> = {};

    for (const order of orders) {
      revenue += Number(order.total);
      for (const item of order.items) {
        items += item.quantity;
        if (item.size) {
          cupsBySize[item.size] = (cupsBySize[item.size] ?? 0) + item.quantity;
        }
      }
    }

    return {
      orders: orders.length,
      items,
      revenue: Math.round(revenue * 100) / 100,
      cupsBySize,
    };
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
}
