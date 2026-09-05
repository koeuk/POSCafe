import { BadRequestException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import {
  OrderItem,
  OrderItemExtra,
} from '../orders/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import { lineQuantityInStockUnit } from '../recipes/recipe-servings';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { convertQuantity, formatQuantity } from './units';

/**
 * Where an order line's units came from, recorded on the order item so a
 * cancel/refund reverses exactly what the sale did — even if the product's
 * stock mode or recipe changed in between.
 *
 *  - 'recipe': the product is made to order; the sale consumed consumables
 *    (cups, lids, beans, milk…).
 *  - 'stock':  the product is counted; the sale took units off its stock.
 */
export type StockSource = 'recipe' | 'stock';

export const MOVEMENT_ORDER_DEDUCTION = 'order_deduction';
export const MOVEMENT_ORDER_REVERSAL = 'order_refund';

export interface OrderLine {
  /** Locked (pessimistic_write) by the caller. */
  product: Product;
  size: string | null;
  quantity: number;
  /** Customer's-choice add-ons: amount per drink of an optional line, in
   *  that line's unit (15 for "15 g" of sugar). */
  extras?: { inventoryItemId: number; quantity: number }[];
}

export interface ReservedLine {
  stockSource: StockSource;
  /** The add-ons actually applied, with names for the order snapshot. */
  extras: OrderItemExtra[] | null;
}

interface IngredientNeed {
  quantity: number;
  products: Set<string>;
}

/**
 * The recipe that governs a product + size: an exact size match wins, a
 * size-less recipe is the default for every size. null when the product has
 * no usable recipe for that size.
 */
export async function findRecipe(
  manager: EntityManager,
  productId: number,
  size: string | null,
): Promise<Recipe | null> {
  // Ingredients come along so recipe amounts can be converted into each
  // item's stock unit (a 10 g line against coffee kept in kg).
  const relations = { items: { inventoryItem: true } } as const;
  let recipe: Recipe | null = null;
  if (size) {
    recipe = await manager.findOne(Recipe, {
      where: { productId, size },
      relations,
    });
  }
  if (!recipe) {
    recipe = await manager.findOne(Recipe, {
      where: { productId, size: IsNull() },
      relations,
    });
  }
  return recipe && recipe.items.length > 0 ? recipe : null;
}

/**
 * One order's stock deduction, run inside the order's transaction.
 *
 * Usage: `reserveLine()` per line (takes counted units off the product right
 * away, or collects the recipe's ingredient needs), then `commitIngredients()`
 * once the order row exists so the consumable movements can carry its id.
 *
 * Ingredient needs are accumulated across lines and applied once per
 * inventory item, in id order — so two drinks sharing milk lock the milk row
 * once, and concurrent orders always lock items in the same order (no
 * deadlocks).
 */
export class OrderStockDeduction {
  private readonly needs = new Map<number, IngredientNeed>();

  constructor(private readonly manager: EntityManager) {}

  async reserveLine(line: OrderLine): Promise<ReservedLine> {
    const { product, size, quantity } = line;
    const label = size ? `${product.name} (${size})` : product.name;
    const extras = line.extras ?? [];

    if (product.stockMode === 'recipe') {
      const recipe = await findRecipe(this.manager, product.id, size);
      if (!recipe) {
        throw new BadRequestException(
          `"${label}" is made to order but has no recipe yet — add one on the Inventory page`,
        );
      }
      // Add-ons may only name the recipe's customer's-choice lines.
      const optional = new Map(
        recipe.items
          .filter((i) => i.optional)
          .map((i) => [i.inventoryItemId, i]),
      );
      const applied: OrderItemExtra[] = [];
      for (const extra of extras) {
        const item = optional.get(extra.inventoryItemId);
        if (!item) {
          throw new BadRequestException(
            `"${label}" has no optional add-on #${extra.inventoryItemId}`,
          );
        }
        applied.push({
          inventoryItemId: item.inventoryItemId,
          name: item.inventoryItem?.name ?? `#${item.inventoryItemId}`,
          quantity: extra.quantity,
          unit: item.unit ?? item.inventoryItem?.unit ?? '',
        });
      }
      for (const item of recipe.items) {
        // Base lines take the recipe amount every time; optional lines take
        // the amount typed at checkout (in the line's unit), or nothing.
        let perDrink: number;
        if (item.optional) {
          const chosen = applied.find(
            (e) => e.inventoryItemId === item.inventoryItemId,
          );
          if (!chosen) continue;
          const stockUnit = item.inventoryItem?.unit ?? chosen.unit;
          perDrink = convertQuantity(chosen.quantity, chosen.unit, stockUnit);
        } else {
          perDrink = lineQuantityInStockUnit(item);
        }
        const need = this.needs.get(item.inventoryItemId) ?? {
          quantity: 0,
          products: new Set<string>(),
        };
        need.quantity += perDrink * quantity;
        need.products.add(label);
        this.needs.set(item.inventoryItemId, need);
      }
      return { stockSource: 'recipe', extras: applied.length ? applied : null };
    }

    if (extras.length > 0) {
      throw new BadRequestException(
        `"${label}" is counted stock and has no add-ons`,
      );
    }

    if (product.stock < quantity) {
      throw new BadRequestException(
        `Insufficient stock for "${product.name}": have ${product.stock}, need ${quantity}`,
      );
    }
    product.stock -= quantity;
    await this.manager.save(product);
    return { stockSource: 'stock', extras: null };
  }

  /** Deducts every accumulated ingredient and journals it against the order. */
  async commitIngredients(
    orderId: number,
    userId: number | null,
  ): Promise<void> {
    const ids = [...this.needs.keys()].sort((a, b) => a - b);
    for (const id of ids) {
      const need = this.needs.get(id)!;
      const item = await this.manager.findOne(InventoryItem, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) {
        throw new BadRequestException(
          `An ingredient used by ${[...need.products].join(', ')} no longer exists — update the recipe`,
        );
      }
      const have = Number(item.stockQuantity);
      const required = round3(need.quantity);
      if (have < required) {
        throw new BadRequestException(
          `Insufficient stock: ${item.name} — required ${formatQuantity(required, item.unit)}, available ${formatQuantity(have, item.unit)} (for ${[...need.products].join(', ')})`,
        );
      }
      item.stockQuantity = round3(have - required);
      await this.manager.save(item);
      await this.manager.save(
        this.manager.create(InventoryMovement, {
          inventoryItemId: item.id,
          delta: -required,
          stockAfter: item.stockQuantity,
          reason: MOVEMENT_ORDER_DEDUCTION,
          orderId,
          userId,
        }),
      );
    }
  }
}

/**
 * Returns everything an order took out of inventory, mirroring the deduction
 * exactly: counted lines go back onto the product's stock; recipe lines are
 * reversed from the journaled consumable movements (not from the current
 * recipe, which may have changed since the sale). Idempotent — a second call
 * for the same order is a no-op.
 */
export async function reverseOrderStock(
  manager: EntityManager,
  orderId: number,
  userId: number | null,
): Promise<void> {
  const items = await manager.find(OrderItem, { where: { orderId } });

  for (const item of items) {
    if (item.stockSource !== 'stock') continue;
    // The product may have been removed since the order was placed — nothing
    // to restock, and that shouldn't block the cancellation.
    const product = await manager.findOne(Product, {
      where: { id: item.productId },
      lock: { mode: 'pessimistic_write' },
    });
    if (product) {
      product.stock += item.quantity;
      await manager.save(product);
    }
  }

  const alreadyReversed = await manager.exists(InventoryMovement, {
    where: { orderId, reason: MOVEMENT_ORDER_REVERSAL },
  });
  if (alreadyReversed) return;

  const deductions = await manager.find(InventoryMovement, {
    where: { orderId, reason: MOVEMENT_ORDER_DEDUCTION },
    order: { inventoryItemId: 'ASC' },
  });
  for (const deduction of deductions) {
    const item = await manager.findOne(InventoryItem, {
      where: { id: deduction.inventoryItemId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!item) continue; // ingredient deleted since — nothing to return
    const returned = -Number(deduction.delta);
    item.stockQuantity = round3(Number(item.stockQuantity) + returned);
    await manager.save(item);
    await manager.save(
      manager.create(InventoryMovement, {
        inventoryItemId: item.id,
        delta: returned,
        stockAfter: item.stockQuantity,
        reason: MOVEMENT_ORDER_REVERSAL,
        orderId,
        userId,
      }),
    );
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
