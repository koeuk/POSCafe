import { toNumber } from '../common/money';
import { Recipe } from './entities/recipe.entity';

/**
 * How many servings a recipe can make right now: the tightest ingredient
 * decides. 0 for an empty recipe. `recipe.items[].inventoryItem` must be
 * loaded.
 */
export function recipeServings(recipe: Recipe): number {
  if (!recipe.items || recipe.items.length === 0) return 0;
  const servings = Math.floor(
    Math.min(
      ...recipe.items.map((item) => {
        const per = toNumber(item.quantity);
        if (per <= 0) return Infinity;
        return toNumber(item.inventoryItem?.stockQuantity ?? 0) / per;
      }),
    ),
  );
  return Number.isFinite(servings) ? Math.max(0, servings) : 0;
}
