import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
   * Create or update recipe for a product + size combination.
   */
  async createOrUpdate(dto: CreateRecipeDto): Promise<Recipe> {
    return this.dataSource.transaction(async (manager) => {
      const sizeParam = dto.size ? dto.size.trim() : null;

      let recipe = await manager.findOne(Recipe, {
        where: {
          productId: dto.productId,
          size: sizeParam === null ? (null as any) : sizeParam,
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
        }),
      );
      await manager.save(RecipeItem, items);

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

  async remove(id: number): Promise<void> {
    const recipe = await this.findOne(id);
    await this.recipeRepo.remove(recipe);
  }
}
