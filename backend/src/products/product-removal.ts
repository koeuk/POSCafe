import { EntityManager } from 'typeorm';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Product } from './entities/product.entity';

export type RemovalOutcome = 'deleted' | 'archived';

/** Number of past order lines that reference the product. */
export function countOrderLines(
  manager: EntityManager,
  productId: number,
): Promise<number> {
  return manager.count(OrderItem, { where: { productId } });
}

/**
 * Takes a product out of the catalog. One with no sales history is deleted
 * outright (variants, recipes and stock movements cascade with it). One that
 * appears in past orders is archived instead: hidden from the menu, POS,
 * catalog and stock reports, while order history and sales reports keep
 * pointing at it. Runs inside the caller's transaction.
 */
export async function removeProduct(
  manager: EntityManager,
  product: Product,
  options: { detachCategory?: boolean } = {},
): Promise<RemovalOutcome> {
  const lines = await countOrderLines(manager, product.id);
  if (lines === 0) {
    await manager.remove(Product, product);
    return 'deleted';
  }
  product.archivedAt = new Date();
  product.isAvailable = false;
  if (options.detachCategory) {
    product.categoryId = null;
    // TypeORM resolves the join column from a loaded relation object in
    // preference to the raw id, so the stale relation must go too.
    Reflect.deleteProperty(product, 'category');
  }
  await manager.save(Product, product);
  return 'archived';
}
