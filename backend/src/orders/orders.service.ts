import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrderStatus } from '../common/enums/order-status.enum';
import { Product } from '../products/entities/product.entity';
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
        if (product.stock < line.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}" (have ${product.stock}, need ${line.quantity})`,
          );
        }

        const unitPrice = Number(product.price);
        const subtotal = unitPrice * line.quantity;
        total += subtotal;

        product.stock -= line.quantity;
        await manager.save(product);

        items.push(
          manager.create(OrderItem, {
            productId: product.id,
            quantity: line.quantity,
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
