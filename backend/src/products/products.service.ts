import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { CreateProductDto, ProductSizeDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductVariant } from './entities/product-variant.entity';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    private readonly categoriesService: CategoriesService,
  ) {}

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

  async create(dto: CreateProductDto): Promise<Product> {
    // Ensure the category exists (throws NotFound otherwise).
    await this.categoriesService.findOne(dto.categoryId);
    const { sizes, ...productFields } = dto;
    const product = this.repo.create(productFields);
    // Seed the capacity high-water mark from the initial stock.
    product.totalStock = dto.stock ?? 0;
    const saved = await this.repo.save(product);
    await this.syncVariants(saved.id, sizes ?? null);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    if (dto.categoryId !== undefined) {
      await this.categoriesService.findOne(dto.categoryId);
    }
    const { sizes, ...productFields } = dto;
    Object.assign(product, productFields);
    // Raise the capacity high-water mark when stock is (re)set.
    if (dto.stock !== undefined) {
      product.totalStock = Math.max(product.totalStock ?? 0, dto.stock);
    }
    // `findOne` eager-loads `category`, and TypeORM resolves the join column
    // from that relation object in preference to the raw `categoryId` — so
    // leaving a stale relation attached would silently undo a category move.
    if (dto.categoryId !== undefined) {
      Reflect.deleteProperty(product, 'category');
    }
    await this.repo.save(product);
    // Only reconcile size variants when sizes were part of the update.
    if (sizes !== undefined) {
      await this.syncVariants(id, sizes);
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
        if (s.stock !== undefined) {
          current.stock = s.stock;
          current.totalStock = Math.max(current.totalStock ?? 0, s.stock);
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
            totalStock: s.stock ?? 0,
          }),
        );
      }
    }
  }
}
