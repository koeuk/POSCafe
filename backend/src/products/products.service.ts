import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { OrderStatus } from '../common/enums/order-status.enum';
import { toNumber } from '../common/money';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
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

/**
 * How many servings of a product (size) its recipe can currently make: the
 * tightest ingredient decides. Returned on every product so the POS and the
 * Inventory page can treat recipe products as "made to order" and never look
 * at the finished-drink stock count for them.
 */
export interface RecipeAvailability {
  size: string | null;
  servings: number;
}

export type ProductWithAvailability = Product & {
  recipes: RecipeAvailability[];
};

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
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    private readonly categoriesService: CategoriesService,
  ) {}

  /** Attaches recipe availability (see RecipeAvailability) to each product. */
  private async withAvailability(
    products: Product[],
  ): Promise<ProductWithAvailability[]> {
    if (products.length === 0) return [];
    const recipes = await this.recipeRepo.find({
      where: { productId: In(products.map((p) => p.id)) },
      relations: { items: { inventoryItem: true } },
    });
    const byProduct = new Map<number, RecipeAvailability[]>();
    for (const recipe of recipes) {
      if (recipe.items.length === 0) continue; // empty recipe = stock-counted
      const servings = Math.floor(
        Math.min(
          ...recipe.items.map((item) => {
            const per = toNumber(item.quantity);
            if (per <= 0) return Infinity;
            return toNumber(item.inventoryItem?.stockQuantity ?? 0) / per;
          }),
        ),
      );
      const list = byProduct.get(recipe.productId) ?? [];
      list.push({
        size: recipe.size,
        servings: Number.isFinite(servings) ? Math.max(0, servings) : 0,
      });
      byProduct.set(recipe.productId, list);
    }
    return products.map((p) =>
      Object.assign(p, { recipes: byProduct.get(p.id) ?? [] }),
    );
  }

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

  async findAll(categoryId?: number): Promise<ProductWithAvailability[]> {
    const products = await this.repo.find({
      where: categoryId ? { categoryId } : {},
      relations: { category: true, variants: true },
      order: { name: 'ASC', variants: { sortOrder: 'ASC' } },
    });
    return this.withAvailability(products);
  }

  async findOne(id: number): Promise<ProductWithAvailability> {
    const product = await this.repo.findOne({
      where: { id },
      relations: { category: true, variants: true },
      order: { variants: { sortOrder: 'ASC' } },
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    const [withAvailability] = await this.withAvailability([product]);
    return withAvailability;
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
      // A sized product keeps its quantities on the variants, so the base
      // column must not keep the figure it held while the product was
      // sizeless. totalStock() prefers variants and hides the stale number,
      // but it stays in the table waiting for the next query that sums
      // products.stock to report cups that don't exist. Journal the drop so
      // the correction is visible rather than silent.
      if (sizes !== null && sizes.length > 0 && product.stock !== 0) {
        await this.recordMovement(id, null, -product.stock, 0, userId ?? null);
        await this.repo.update(id, { stock: 0 });
      }
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
   * Keeps recipes attached to the sizes a product actually sells, so a size
   * change never leaves a recipe the POS can't reach or the editor can't show:
   *
   *  - renamed size (a removed variant whose position now holds a new name):
   *    the recipe follows the new name;
   *  - removed size: its recipe goes too;
   *  - sizeless → sized: the sizeless recipe is copied to every new size as a
   *    starting point;
   *  - sized → sizeless: the first size's recipe becomes the sizeless one.
   */
  private async syncRecipes(
    productId: number,
    existing: ProductVariant[],
    wanted: ProductSizeDto[],
    removed: ProductVariant[],
  ): Promise<void> {
    const recipes = await this.recipeRepo.find({
      where: { productId },
      relations: { items: true },
    });
    if (recipes.length === 0) return;

    const existingSizes = new Set(existing.map((v) => v.size));
    const added = wanted.filter((s) => !existingSizes.has(s.size));
    const recipeFor = (size: string | null) =>
      recipes.find((r) => r.size === size) ?? null;
    const cloneTo = async (source: Recipe, size: string | null) => {
      const copy = this.recipeRepo.create({
        productId,
        size,
        items: source.items.map((i) => ({
          inventoryItemId: i.inventoryItemId,
          quantity: i.quantity,
        })),
      });
      await this.recipeRepo.save(copy);
    };

    // sized → sizeless
    if (wanted.length === 0 && existing.length > 0) {
      const first = [...existing].sort((a, b) => a.sortOrder - b.sortOrder);
      const keep = first.map((v) => recipeFor(v.size)).find(Boolean) ?? null;
      const sizeless = recipeFor(null);
      if (keep && !sizeless) await cloneTo(keep, null);
      await this.recipeRepo.remove(recipes.filter((r) => r.size !== null));
      return;
    }

    // sizeless → sized
    if (existing.length === 0 && wanted.length > 0) {
      const sizeless = recipeFor(null);
      if (sizeless) {
        for (const s of wanted) {
          if (!recipeFor(s.size)) await cloneTo(sizeless, s.size);
        }
        await this.recipeRepo.remove(sizeless);
      }
      return;
    }

    // Renames and removals among an already-sized product.
    for (const variant of removed) {
      const recipe = recipeFor(variant.size);
      if (!recipe) continue;
      const replacement = wanted[variant.sortOrder];
      const isRename =
        replacement !== undefined &&
        added.some((s) => s.size === replacement.size) &&
        !recipeFor(replacement.size);
      if (isRename) {
        recipe.size = replacement.size;
        await this.recipeRepo.save(recipe);
      } else {
        await this.recipeRepo.remove(recipe);
      }
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
    await this.syncRecipes(productId, existing, wanted, toRemove);
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
