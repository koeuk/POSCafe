import { toNumber } from '../common/money';
import { convertQuantity, unitsCompatible } from '../inventory/units';
import { RecipeItem } from './entities/recipe-item.entity';
import { Recipe } from './entities/recipe.entity';

/**
 * A recipe line's quantity in its ingredient's stock unit (10 g of coffee
 * stocked in kg → 0.01). A line whose unit no longer matches the item (the
 * item's unit was edited) is taken at face value rather than failing the
 * whole menu. `item.inventoryItem` must be loaded.
 */
export function lineQuantityInStockUnit(item: RecipeItem): number {
  const quantity = toNumber(item.quantity);
  const stockUnit = item.inventoryItem?.unit;
  if (!item.unit || !stockUnit || !unitsCompatible(item.unit, stockUnit)) {
    return quantity;
  }
  return convertQuantity(quantity, item.unit, stockUnit);
}

/**
 * How many servings a recipe can make right now: the tightest ingredient
 * decides. 0 for an empty recipe. `recipe.items[].inventoryItem` must be
 * loaded.
 */
export function recipeServings(recipe: Recipe): number {
  // Customer's-choice lines are add-ons, not part of the base serving.
  const base = (recipe.items ?? []).filter((item) => !item.optional);
  if (base.length === 0) return 0;
  const servings = Math.floor(
    Math.min(
      ...base.map((item) => {
        const per = lineQuantityInStockUnit(item);
        if (per <= 0) return Infinity;
        return toNumber(item.inventoryItem?.stockQuantity ?? 0) / per;
      }),
    ),
  );
  return Number.isFinite(servings) ? Math.max(0, servings) : 0;
}
