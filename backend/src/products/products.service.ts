import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { countOrderLines, removeProduct } from './product-removal';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { OrderStatus } from '../common/enums/order-status.enum';
import { toNumber } from '../common/money';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import { recipeServings } from '../recipes/recipe-servings';
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
 * Servings a 'recipe' product can make for one size (null size = the recipe
 * that covers every size). Returned on every product so the POS and the
 * Inventory page never have to compute it themselves.
 */
export interface RecipeAvailability {
  size: string | null;
  servings: number;
  // Customer's-choice lines (sugar, straw…) the POS offers at checkout.
  options: RecipeOption[];
}

export interface RecipeOption {
  inventoryItemId: number;
  name: string;
  // Per portion, in the line's unit (10 g, 1 pcs).
  quantity: number;
  unit: string;
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

  /**
   * Attaches recipe availability to each product. Only 'recipe' products
   * get entries — a 'count' product's availability is simply its `stock`.
   */
  private async withAvailability(
    products: Product[],
  ): Promise<ProductWithAvailability[]> {
    const recipeProducts = products.filter((p) => p.stockMode === 'recipe');
    const byProduct = new Map<number, RecipeAvailability[]>();
    if (recipeProducts.length > 0) {
      const recipes = await this.recipeRepo.find({
        where: { productId: In(recipeProducts.map((p) => p.id)) },
        relations: { items: { inventoryItem: true } },
      });
      for (const recipe of recipes) {
        const list = byProduct.get(recipe.productId) ?? [];
        list.push({
          size: recipe.size,
          servings: recipeServings(recipe),
          options: recipe.items
            .filter((i) => i.optional && i.inventoryItem)
            .map((i) => ({
              inventoryItemId: i.inventoryItemId,
              name: i.inventoryItem.name,
              quantity: Number(i.quantity),
              unit: i.unit ?? i.inventoryItem.unit,
            })),
        });
        byProduct.set(recipe.productId, list);
      }
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
    delta: number,
    stockAfter: number,
    userId: number | null,
  ): Promise<void> {
    if (delta === 0) return;
    await this.movementRepo.save(
      this.movementRepo.create({ productId, delta, stockAfter, userId }),
    );
  }

  async findAll(categoryId?: number): Promise<ProductWithAvailability[]> {
    const products = await this.repo.find({
      where: { ...(categoryId ? { categoryId } : {}), archivedAt: IsNull() },
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
    const stockMode = dto.stockMode ?? 'count';
    // A made-to-order product never holds finished stock.
    const stock = stockMode === 'recipe' ? 0 : (dto.stock ?? 0);
    const product = this.repo.create({ ...productFields, stockMode, stock });
    const saved = await this.repo.save(product);
    if (stock > 0) {
      await this.recordMovement(saved.id, stock, stock, userId ?? null);
    }
    await this.syncVariants(saved.id, sizes ?? null);
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
    const previousMode = product.stockMode;
    const { sizes, ...productFields } = dto;
    Object.assign(product, productFields);

    // Switching to made-to-order: the finished-stock count no longer means
    // anything, so it is cleared (journaled) rather than left to confuse.
    if (product.stockMode === 'recipe') {
      product.stock = 0;
    }

    // `findOne` eager-loads `category`, and TypeORM resolves the join column
    // from that relation object in preference to the raw `categoryId` — so
    // leaving a stale relation attached would silently undo a category move.
    if (dto.categoryId !== undefined) {
      Reflect.deleteProperty(product, 'category');
    }
    Reflect.deleteProperty(product, 'recipes');
    await this.repo.save(product);

    if (product.stock !== previousStock) {
      await this.recordMovement(
        id,
        product.stock - previousStock,
        product.stock,
        userId ?? null,
      );
    }
    // Back to counting: the recipes are no longer used, so they go too —
    // hidden data that silently comes back later is exactly the confusion
    // the one-mode rule exists to avoid.
    if (previousMode === 'recipe' && product.stockMode === 'count') {
      await this.recipeRepo.delete({ productId: id });
    }
    // Only reconcile size variants when sizes were part of the update.
    if (sizes !== undefined) {
      await this.syncVariants(id, sizes);
    }
    return this.findOne(id);
  }

  /**
   * Deletes a product. One that appears in past orders can't simply vanish
   * (order lines reference it), so without `force` that is refused with a
   * 409; with `force` it is archived instead — see product-removal.ts.
   */
  async remove(id: number, force = false): Promise<void> {
    const product = await this.findOne(id);
    if (product.archivedAt) return; // already out of the catalog
    const lines = await countOrderLines(this.repo.manager, id);
    if (lines > 0 && !force) {
      throw new ConflictException(
        `"${product.name}" appears in ${lines} past order line${lines === 1 ? '' : 's'}, so it can't be deleted outright. Deleting anyway archives it: it disappears from the menu, POS and stock reports, while order history keeps it.`,
      );
    }
    await this.repo.manager.transaction((manager) =>
      removeProduct(manager, product),
    );
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
          unit: i.unit,
          optional: i.optional,
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
   * Reconciles the variant rows (size name + price, in display order) to
   * match the submitted size options, removing variants for sizes that no
   * longer exist.
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
        await this.variantRepo.save(current);
      } else {
        await this.variantRepo.save(
          this.variantRepo.create({
            productId,
            size: s.size,
            price: s.price,
            sortOrder: index,
          }),
        );
      }
    }
  }
}
