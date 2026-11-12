import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { lockProduct } from '../prisma/locks';
import { normalizeUnit, unitsCompatible } from '../inventory/units';
import { CreateRecipeDto } from './dto/create-recipe.dto';

const include = {
  product: true,
  items: { include: { inventoryItem: true } },
} as const;

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}
  findAll() {
    return this.prisma.recipe.findMany({
      include,
      orderBy: [{ productId: 'asc' }, { size: 'asc' }],
    });
  }
  findByProduct(productId: number) {
    return this.prisma.recipe.findMany({
      where: { productId },
      include: { items: include.items },
      orderBy: { size: 'asc' },
    });
  }
  async findOne(id: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include,
    });
    if (!recipe) throw new NotFoundException(`Recipe #${id} not found`);
    return recipe;
  }
  async createOrUpdate(dto: CreateRecipeDto, userId: number | null = null) {
    return this.prisma.$transaction(async (tx) => {
      const size = dto.size?.trim() || null;
      const product = await lockProduct(tx, dto.productId);
      if (!product)
        throw new NotFoundException(`Product #${dto.productId} not found`);
      const variants = await tx.productVariant.findMany({
        where: { productId: product.id },
      });
      const sizes = variants.map((v) => v.size);
      if (sizes.length && (!size || !sizes.includes(size))) {
        throw new BadRequestException(
          `"${product.name}" is sold in sizes ${sizes.join(', ')} — pick one of them for the recipe`,
        );
      }
      if (!sizes.length && size)
        throw new BadRequestException(
          `"${product.name}" has no sizes — save the recipe without a size`,
        );
      const ids = dto.items.map((i) => i.inventoryItemId);
      if (new Set(ids).size !== ids.length)
        throw new BadRequestException(
          'Each ingredient can appear only once in a recipe',
        );
      const ingredients = await tx.inventoryItem.findMany({
        where: { id: { in: ids } },
      });
      const items = dto.items.map((item) => {
        const ingredient = ingredients.find(
          (i) => i.id === item.inventoryItemId,
        );
        if (!ingredient)
          throw new NotFoundException(
            `Inventory item #${item.inventoryItemId} not found`,
          );
        const unit = item.unit?.trim() ? normalizeUnit(item.unit) : null;
        if (unit && !unitsCompatible(unit, ingredient.unit)) {
          throw new BadRequestException(
            `"${ingredient.name}" is stocked in ${ingredient.unit} — a recipe cannot take it in ${unit}`,
          );
        }
        return {
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          unit: unit && unit !== normalizeUnit(ingredient.unit) ? unit : null,
          optional: item.optional ?? false,
        };
      });
      // Locking the parent serializes sizeless recipes too: MySQL allows duplicate NULLs in unique indexes.
      let recipe = await tx.recipe.findFirst({
        where: { productId: product.id, size },
      });
      if (recipe)
        await tx.recipeItem.deleteMany({ where: { recipeId: recipe.id } });
      else
        recipe = await tx.recipe.create({
          data: { productId: product.id, size },
        });
      await tx.recipeItem.createMany({
        data: items.map((item) => ({ ...item, recipeId: recipe.id })),
      });
      await tx.product.update({
        where: { id: product.id },
        data: { stockMode: 'recipe', stock: 0 },
      });
      if (product.stock > 0)
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            delta: -product.stock,
            stockAfter: 0,
            userId,
          },
        });
      return tx.recipe.findUniqueOrThrow({ where: { id: recipe.id }, include });
    });
  }
  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.prisma.recipe.delete({ where: { id } });
  }
}
