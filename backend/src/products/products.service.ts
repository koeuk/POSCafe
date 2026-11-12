import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductVariant } from '@prisma/client';
import { CategoriesService } from '../categories/categories.service';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PrismaService } from '../prisma/prisma.service';
import { lockProduct } from '../prisma/locks';
import type { ProductWithDetails } from '../prisma/models';
import { recipeServings } from '../recipes/recipe-servings';
import { CreateProductDto, ProductSizeDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { countOrderLines, removeProduct } from './product-removal';

export interface SoldCount {
  productId: number;
  sold: number;
}
export interface RecipeOption {
  inventoryItemId: number;
  name: string;
  quantity: number;
  unit: string;
}
export interface RecipeAvailability {
  size: string | null;
  servings: number;
  options: RecipeOption[];
}
export type ProductWithAvailability = ProductWithDetails & {
  recipes: RecipeAvailability[];
};
const include = {
  category: true,
  variants: { orderBy: { sortOrder: 'asc' } },
} as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
  ) {}

  private async withAvailability(
    products: ProductWithDetails[],
  ): Promise<ProductWithAvailability[]> {
    const ids = products
      .filter((p) => p.stockMode === 'recipe')
      .map((p) => p.id);
    const byProduct = new Map<number, RecipeAvailability[]>();
    if (ids.length) {
      const recipes = await this.prisma.recipe.findMany({
        where: { productId: { in: ids } },
        include: { items: { include: { inventoryItem: true } } },
      });
      for (const recipe of recipes) {
        const list = byProduct.get(recipe.productId) ?? [];
        list.push({
          size: recipe.size,
          servings: recipeServings(recipe),
          options: recipe.items
            .filter((i) => i.optional)
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
    return products.map((p) => ({ ...p, recipes: byProduct.get(p.id) ?? [] }));
  }
  async findSoldCounts(): Promise<SoldCount[]> {
    const rows = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { status: { not: OrderStatus.CANCELLED } } },
      _sum: { quantity: true },
    });
    return rows.map((r) => ({
      productId: r.productId,
      sold: r._sum.quantity ?? 0,
    }));
  }
  findMovements(limit = 50) {
    return this.prisma.stockMovement.findMany({
      include: { product: true, user: { omit: { password: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
  private async recordMovement(
    tx: Prisma.TransactionClient,
    productId: number,
    delta: number,
    stockAfter: number,
    userId: number | null,
  ) {
    if (delta)
      await tx.stockMovement.create({
        data: { productId, delta, stockAfter, userId },
      });
  }
  async findAll(categoryId?: number): Promise<ProductWithAvailability[]> {
    const products = await this.prisma.product.findMany({
      where: { ...(categoryId ? { categoryId } : {}), archivedAt: null },
      include,
      orderBy: { name: 'asc' },
    });
    return this.withAvailability(products);
  }
  async findOne(id: number): Promise<ProductWithAvailability> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include,
    });
    if (!product) throw new NotFoundException(`Product #${id} not found`);
    return (await this.withAvailability([product]))[0];
  }
  async create(dto: CreateProductDto, userId?: number) {
    await this.categoriesService.findOne(dto.categoryId);
    const { sizes, gallery, ...fields } = dto;
    const stockMode = dto.stockMode ?? 'count';
    const stock = stockMode === 'recipe' ? 0 : (dto.stock ?? 0);
    const id = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...fields,
          stockMode,
          stock,
          gallery: gallery === null ? Prisma.DbNull : gallery,
        },
      });
      await this.recordMovement(tx, product.id, stock, stock, userId ?? null);
      await this.syncVariants(tx, product.id, sizes ?? null);
      return product.id;
    });
    return this.findOne(id);
  }
  async update(id: number, dto: UpdateProductDto, userId?: number) {
    if (dto.categoryId !== undefined)
      await this.categoriesService.findOne(dto.categoryId);
    await this.prisma.$transaction(async (tx) => {
      const product = await lockProduct(tx, id);
      if (!product) throw new NotFoundException(`Product #${id} not found`);
      const { sizes, gallery, ...fields } = dto;
      const stockMode = dto.stockMode ?? product.stockMode;
      const stock = stockMode === 'recipe' ? 0 : (dto.stock ?? product.stock);
      await tx.product.update({
        where: { id },
        data: {
          ...fields,
          stockMode,
          stock,
          gallery: gallery === null ? Prisma.DbNull : gallery,
        },
      });
      await this.recordMovement(
        tx,
        id,
        stock - product.stock,
        stock,
        userId ?? null,
      );
      if (product.stockMode === 'recipe' && stockMode === 'count')
        await tx.recipe.deleteMany({ where: { productId: id } });
      if (sizes !== undefined) await this.syncVariants(tx, id, sizes);
    });
    return this.findOne(id);
  }
  async remove(id: number, force = false): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const product = await lockProduct(tx, id);
      if (!product) throw new NotFoundException(`Product #${id} not found`);
      if (product.archivedAt) return;
      const lines = await countOrderLines(tx, id);
      if (lines > 0 && !force)
        throw new ConflictException(
          `"${product.name}" appears in ${lines} past order line${lines === 1 ? '' : 's'}, so it can't be deleted outright. Deleting anyway archives it: it disappears from the menu, POS and stock reports, while order history keeps it.`,
        );
      await removeProduct(tx, product);
    });
  }

  /** Keep recipes attached when sizes are renamed, added, or removed. */
  private async syncRecipes(
    tx: Prisma.TransactionClient,
    productId: number,
    existing: ProductVariant[],
    wanted: ProductSizeDto[],
    removed: ProductVariant[],
  ) {
    const recipes = await tx.recipe.findMany({
      where: { productId },
      include: { items: true },
    });
    if (!recipes.length) return;
    const existingSizes = new Set(existing.map((v) => v.size));
    const added = wanted.filter((s) => !existingSizes.has(s.size));
    const recipeFor = (size: string | null) =>
      recipes.find((r) => r.size === size) ?? null;
    const cloneTo = async (
      source: (typeof recipes)[number],
      size: string | null,
    ) => {
      await tx.recipe.create({
        data: {
          productId,
          size,
          items: {
            create: source.items.map((i) => ({
              inventoryItemId: i.inventoryItemId,
              quantity: i.quantity,
              unit: i.unit,
              optional: i.optional,
            })),
          },
        },
      });
    };
    if (!wanted.length && existing.length) {
      const keep = [...existing]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => recipeFor(v.size))
        .find(Boolean);
      if (keep && !recipeFor(null)) await cloneTo(keep, null);
      await tx.recipe.deleteMany({ where: { productId, size: { not: null } } });
      return;
    }
    if (!existing.length && wanted.length) {
      const sizeless = recipeFor(null);
      if (sizeless) {
        for (const s of wanted)
          if (!recipeFor(s.size)) await cloneTo(sizeless, s.size);
        await tx.recipe.delete({ where: { id: sizeless.id } });
      }
      return;
    }
    for (const variant of removed) {
      const recipe = recipeFor(variant.size);
      if (!recipe) continue;
      const replacement = wanted[variant.sortOrder];
      const isRename =
        replacement &&
        added.some((s) => s.size === replacement.size) &&
        !recipeFor(replacement.size);
      if (isRename) {
        await tx.recipe.update({
          where: { id: recipe.id },
          data: { size: replacement.size },
        });
        recipe.size = replacement.size;
      } else await tx.recipe.delete({ where: { id: recipe.id } });
    }
  }
  private async syncVariants(
    tx: Prisma.TransactionClient,
    productId: number,
    sizes: ProductSizeDto[] | null,
  ) {
    const existing = await tx.productVariant.findMany({ where: { productId } });
    const wanted = sizes ?? [];
    const wantedSizes = new Set(wanted.map((s) => s.size));
    const removed = existing.filter((v) => !wantedSizes.has(v.size));
    await this.syncRecipes(tx, productId, existing, wanted, removed);
    await tx.productVariant.deleteMany({
      where: { id: { in: removed.map((v) => v.id) } },
    });
    for (const [sortOrder, s] of wanted.entries()) {
      await tx.productVariant.upsert({
        where: { productId_size: { productId, size: s.size } },
        create: { productId, size: s.size, price: s.price, sortOrder },
        update: { price: s.price, sortOrder },
      });
    }
  }
}
