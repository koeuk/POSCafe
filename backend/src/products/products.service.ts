import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { OrderStatus } from '../common/enums/order-status.enum';
import { toNumber } from '../common/money';
import { OrderItem } from '../orders/entities/order-item.entity';
import { CreateProductDto, ProductSizeDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductVariant } from './entities/product-variant.entity';
import { Product } from './entities/product.entity';
import { StockMovement } from './entities/stock-movement.entity';

// Units sold per product (across all non-cancelled orders).
export interface SoldCount {
  productId: number;
  sold: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(StockMovement)
    private readonly movementRepo: Repository<StockMovement>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * Units sold per product, straight from order_items (excluding cancelled
   * orders) — the orders table is the source of truth for sales, so this is
   * accurate over the product's whole history.
   */
  async findSoldCounts(): Promise<SoldCount[]> {
    const rows = await this.orderItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'o', 'o.status != :cancelled', {
        cancelled: OrderStatus.CANCELLED,
      })
      .select('item.productId', 'productId')
      .addSelect('SUM(item.quantity)', 'sold')
      .groupBy('item.productId')
      .getRawMany<{ productId: number; sold: string }>();
    return rows.map((r) => ({
      productId: Number(r.productId),
      sold: toNumber(r.sold),
    }));
  }

  /** Recent manual stock changes (restocks/corrections), newest first. */
  findMovements(limit = 50): Promise<StockMovement[]> {
    return this.movementRepo.find({
      relations: { product: true, user: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /** Log a manual stock change (no row for a no-op delta). */
  private async recordMovement(
    productId: number,
    size: string | null,
    delta: number,
    stockAfter: number,
    userId: number | null,
  ): Promise<void> {
    if (delta === 0) return;
    await this.movementRepo.save(
      this.movementRepo.create({ productId, size, delta, stockAfter, userId }),
    );
  }

  findAll(categoryId?: number): Promise<Product[]> {
    return this.repo.find({
      where: categoryId ? { categoryId } : {},
      relations: { category: true, variants: true },
      order: { name: 'ASC', variants: { sortOrder: 'ASC' } },
    });
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.repo.findOne({
      where: { id },
      relations: { category: true, variants: true },
      order: { variants: { sortOrder: 'ASC' } },
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  async create(dto: CreateProductDto, userId?: number): Promise<Product> {
    // Ensure the category exists (throws NotFound otherwise).
    await this.categoriesService.findOne(dto.categoryId);
    const { sizes, ...productFields } = dto;
    const product = this.repo.create(productFields);
    const saved = await this.repo.save(product);
    if ((dto.stock ?? 0) > 0 && !(sizes && sizes.length > 0)) {
      await this.recordMovement(
        saved.id,
        null,
        dto.stock ?? 0,
        dto.stock ?? 0,
        userId ?? null,
      );
    }
    await this.syncVariants(saved.id, sizes ?? null, userId ?? null);
    return this.findOne(saved.id);
  }

  async update(
    id: number,
    dto: UpdateProductDto,
    userId?: number,
  ): Promise<Product> {
    const product = await this.findOne(id);
    if (dto.categoryId !== undefined) {
      await this.categoriesService.findOne(dto.categoryId);
    }
    const previousStock = product.stock;
    const { sizes, ...productFields } = dto;
    Object.assign(product, productFields);
    // `findOne` eager-loads `category`, and TypeORM resolves the join column
    // from that relation object in preference to the raw `categoryId` — so
    // leaving a stale relation attached would silently undo a category move.
    if (dto.categoryId !== undefined) {
      Reflect.deleteProperty(product, 'category');
    }
    await this.repo.save(product);
    // Log a manual base-stock change (sized products track stock per-size).
    if (dto.stock !== undefined && dto.stock !== previousStock) {
      await this.recordMovement(
        id,
        null,
        dto.stock - previousStock,
        dto.stock,
        userId ?? null,
      );
    }
    // Only reconcile size variants when sizes were part of the update.
    if (sizes !== undefined) {
      await this.syncVariants(id, sizes, userId ?? null);
    }
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);
    try {
      await this.repo.remove(product); // variants cascade-delete
    } catch (err) {
      // order_items.product is ON DELETE RESTRICT, so a product that appears in
      // any past order can't be deleted. Surface a clear 409 instead of a raw
      // 500 from the FK violation.
      const driver = (
        err as { driverError?: { errno?: number; code?: string } }
      ).driverError;
      if (
        err instanceof QueryFailedError &&
        (driver?.errno === 1451 || driver?.code === 'ER_ROW_IS_REFERENCED_2')
      ) {
        throw new ConflictException(
          `"${product.name}" can't be deleted because it appears in past orders. Mark it unavailable instead.`,
        );
      }
      throw err;
    }
  }

  /**
   * Reconciles the variant rows (the single source of size name, price and
   * stock) to match the submitted size options: upserts each size in order
   * (preserving existing stock when the DTO omits it) and removes variants
   * for sizes that no longer exist.
   */
  private async syncVariants(
    productId: number,
    sizes: ProductSizeDto[] | null,
    userId: number | null,
  ): Promise<void> {
    const existing = await this.variantRepo.find({ where: { productId } });
    const wanted = sizes ?? [];
    const wantedSizes = new Set(wanted.map((s) => s.size));

    // Delete variants whose size was removed (or all, if sizes cleared).
    const toRemove = existing.filter((v) => !wantedSizes.has(v.size));
    if (toRemove.length) {
      await this.variantRepo.remove(toRemove);
    }

    // Upsert each wanted size; the array position drives display order.
    for (const [index, s] of wanted.entries()) {
      const current = existing.find((v) => v.size === s.size);
      if (current) {
        current.price = s.price;
        current.sortOrder = index;
        if (s.stock !== undefined && s.stock !== current.stock) {
          await this.recordMovement(
            productId,
            s.size,
            s.stock - current.stock,
            s.stock,
            userId,
          );
          current.stock = s.stock;
        }
        await this.variantRepo.save(current);
      } else {
        await this.variantRepo.save(
          this.variantRepo.create({
            productId,
            size: s.size,
            price: s.price,
            sortOrder: index,
            stock: s.stock ?? 0,
          }),
        );
        if ((s.stock ?? 0) > 0) {
          await this.recordMovement(
            productId,
            s.size,
            s.stock ?? 0,
            s.stock ?? 0,
            userId,
          );
        }
      }
    }
  }
}
