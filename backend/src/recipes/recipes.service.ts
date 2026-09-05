import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { normalizeUnit, unitsCompatible } from '../inventory/units';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../products/entities/stock-movement.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { RecipeItem } from './entities/recipe-item.entity';
import { Recipe } from './entities/recipe.entity';

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(RecipeItem)
    private readonly recipeItemRepo: Repository<RecipeItem>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<Recipe[]> {
    return this.recipeRepo.find({
      relations: {
        product: true,
        items: {
          inventoryItem: true,
        },
      },
      order: { productId: 'ASC', size: 'ASC' },
    });
  }

  async findByProduct(productId: number): Promise<Recipe[]> {
    return this.recipeRepo.find({
      where: { productId },
      relations: {
        items: {
          inventoryItem: true,
        },
      },
      order: { size: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Recipe> {
    const recipe = await this.recipeRepo.findOne({
      where: { id },
      relations: {
        product: true,
        items: {
          inventoryItem: true,
        },
      },
    });
    if (!recipe) {
      throw new NotFoundException(`Recipe #${id} not found`);
    }
    return recipe;
  }

  /**
   * Create or update the recipe for a product + size combination. The size
   * must be one the product actually sells (or none for a sizeless product)
   * so every recipe is reachable from the POS and visible in the editor.
   *
   * Saving a recipe makes the product made to order: its stock mode flips to
   * 'recipe' and any finished-stock count is cleared (journaled) so the
   * Inventory page never shows a stale number next to the servings.
   */
  async createOrUpdate(
    dto: CreateRecipeDto,
    userId: number | null = null,
  ): Promise<Recipe> {
    return this.dataSource.transaction(async (manager) => {
      const sizeParam = dto.size?.trim() || null;

      const product = await manager.findOne(Product, {
        where: { id: dto.productId },
        relations: { variants: true },
      });
      if (!product) {
        throw new NotFoundException(`Product #${dto.productId} not found`);
      }
      const sizes = product.variants.map((v) => v.size);
      if (sizes.length > 0 && (!sizeParam || !sizes.includes(sizeParam))) {
        throw new BadRequestException(
          `"${product.name}" is sold in sizes ${sizes.join(', ')} — pick one of them for the recipe`,
        );
      }
      if (sizes.length === 0 && sizeParam) {
        throw new BadRequestException(
          `"${product.name}" has no sizes — save the recipe without a size`,
        );
      }

      const seen = new Set<number>();
      for (const item of dto.items) {
        if (seen.has(item.inventoryItemId)) {
          throw new BadRequestException(
            'Each ingredient can appear only once in a recipe',
          );
        }
        seen.add(item.inventoryItemId);
      }

      // Every line's unit must convert into its ingredient's stock unit
      // (kg ↔ g, L ↔ ml); the deduction relies on that at sale time.
      const ingredients = await manager.find(InventoryItem, {
        where: { id: In([...seen]) },
      });
      const byId = new Map(ingredients.map((i) => [i.id, i]));
      const lineUnits = new Map<number, string | null>();
      for (const item of dto.items) {
        const ingredient = byId.get(item.inventoryItemId);
        if (!ingredient) {
          throw new NotFoundException(
            `Inventory item #${item.inventoryItemId} not found`,
          );
        }
        const unit = item.unit?.trim() ? normalizeUnit(item.unit) : null;
        if (unit && !unitsCompatible(unit, ingredient.unit)) {
          throw new BadRequestException(
            `"${ingredient.name}" is stocked in ${ingredient.unit} — a recipe cannot take it in ${unit}`,
          );
        }
        lineUnits.set(
          item.inventoryItemId,
          unit && unit !== normalizeUnit(ingredient.unit) ? unit : null,
        );
      }

      let recipe = await manager.findOne(Recipe, {
        where: {
          productId: dto.productId,
          size: sizeParam === null ? IsNull() : sizeParam,
        },
        relations: { items: true },
      });

      if (recipe) {
        // Remove existing items first
        await manager.delete(RecipeItem, { recipeId: recipe.id });
      } else {
        recipe = manager.create(Recipe, {
          productId: dto.productId,
          size: sizeParam,
        });
        recipe = await manager.save(recipe);
      }

      const items = dto.items.map((item) =>
        manager.create(RecipeItem, {
          recipeId: recipe.id,
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          unit: lineUnits.get(item.inventoryItemId) ?? null,
          optional: item.optional ?? false,
        }),
      );
      await manager.save(RecipeItem, items);

      await this.makeToOrder(manager, product, userId);

      return manager.findOneOrFail(Recipe, {
        where: { id: recipe.id },
        relations: {
          product: true,
          items: {
            inventoryItem: true,
          },
        },
      });
    });
  }

  /** Flip a product to 'recipe' mode, clearing its counted stock (journaled). */
  private async makeToOrder(
    manager: EntityManager,
    product: Product,
    userId: number | null,
  ): Promise<void> {
    if (product.stockMode === 'recipe' && product.stock === 0) return;
    const stock = product.stock;
    await manager.update(Product, product.id, {
      stockMode: 'recipe',
      stock: 0,
    });
    if (stock > 0) {
      await manager.save(
        manager.create(StockMovement, {
          productId: product.id,
          delta: -stock,
          stockAfter: 0,
          userId,
        }),
      );
    }
  }

  async remove(id: number): Promise<void> {
    const recipe = await this.findOne(id);
    await this.recipeRepo.remove(recipe);
  }
}
