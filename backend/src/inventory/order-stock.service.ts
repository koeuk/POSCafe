import { BadRequestException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { OrderItem } from '../orders/entities/order-item.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { Product } from '../products/entities/product.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';

/**
 * Where an order line's units came from. Recorded on the order item so a
 * cancel/refund reverses exactly what the sale did, even if the recipe or the
 * product's sizes change in between.
 *
 *  - 'recipe': the product has a recipe, so the sale consumed consumables
 *    (cups, lids, beans, milk…). Finished-drink stock is NOT touched.
 *  - 'stock':  no recipe; the sale consumed the product's own stock count
 *    (per-size variant stock, or the base stock for sizeless products).
 */
export type StockSource = 'recipe' | 'stock';

export const MOVEMENT_ORDER_DEDUCTION = 'order_deduction';
export const MOVEMENT_ORDER_REVERSAL = 'order_refund';

export interface OrderLine {
  /** Locked (pessimistic_write) by the caller. */
  product: Product;
  /** Locked by the caller; null for sizeless products. */
  variant: ProductVariant | null;
  size: string | null;
  quantity: number;
}

interface IngredientNeed {
  quantity: number;
  products: Set<string>;
}

/**
 * Finds the recipe that governs a product + size. An exact size match wins;
 * a size-less recipe acts as the default for every size. Returns null when
 * the product has no (non-empty) recipe, i.e. it is stock-counted.
 */
export async function findRecipe(
  manager: EntityManager,
  productId: number,
  size: string | null,
): Promise<Recipe | null> {
  const relations = { items: true } as const;
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
 * Usage: `reserveLine()` per line (decides recipe vs stock and decrements
 * stock-counted products right away), then `commitIngredients()` once the
 * order row exists so the consumable movements can carry its id.
 *
 * Ingredient needs are accumulated across lines and applied once per
 * inventory item, in id order — so two drinks sharing milk lock the milk row
 * once, and concurrent orders always lock items in the same order (no
 * deadlocks).
 */
export class OrderStockDeduction {
  private readonly needs = new Map<number, IngredientNeed>();

  constructor(private readonly manager: EntityManager) {}

  async reserveLine(line: OrderLine): Promise<StockSource> {
    const { product, variant, size, quantity } = line;

    const recipe = await findRecipe(this.manager, product.id, size);
    if (recipe) {
      for (const item of recipe.items) {
        const need = this.needs.get(item.inventoryItemId) ?? {
          quantity: 0,
          products: new Set<string>(),
        };
        need.quantity += Number(item.quantity) * quantity;
        need.products.add(size ? `${product.name} (${size})` : product.name);
        this.needs.set(item.inventoryItemId, need);
      }
      return 'recipe';
    }

    if (variant) {
      if (variant.stock < quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}" (${size}): have ${variant.stock}, need ${quantity}`,
        );
      }
      variant.stock -= quantity;
      await this.manager.save(variant);
    } else {
      if (product.stock < quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}" (have ${product.stock}, need ${quantity})`,
        );
      }
      product.stock -= quantity;
      await this.manager.save(product);
    }
    return 'stock';
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
      if (have < need.quantity) {
        throw new BadRequestException(
          `Insufficient ${item.name} for ${[...need.products].join(', ')}: have ${have} ${item.unit}, need ${need.quantity} ${item.unit}`,
        );
      }
      item.stockQuantity = round3(have - need.quantity);
      await this.manager.save(item);
      await this.manager.save(
        this.manager.create(InventoryMovement, {
          inventoryItemId: item.id,
          delta: -need.quantity,
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
 * exactly: stock-counted lines go back to their variant/base stock; recipe
 * lines are reversed from the journaled consumable movements (not from the
 * current recipe, which may have changed since the sale). Idempotent — a
 * second call for the same order is a no-op.
 */
export async function reverseOrderStock(
  manager: EntityManager,
  orderId: number,
  userId: number | null,
): Promise<void> {
  const items = await manager.find(OrderItem, { where: { orderId } });

  for (const item of items) {
    if (item.stockSource !== 'stock') continue;

    const variant = item.size
      ? await manager.findOne(ProductVariant, {
          where: { productId: item.productId, size: item.size },
          lock: { mode: 'pessimistic_write' },
        })
      : null;
    if (variant) {
      variant.stock += item.quantity;
      await manager.save(variant);
      continue;
    }
    // The product (or its size) may have been removed since the order was
    // placed — nothing to restock, and that shouldn't block the cancellation.
    const product = await manager.findOne(Product, {
      where: { id: item.productId },
      lock: { mode: 'pessimistic_write' },
    });
    if (product && !item.size) {
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
