import type { Prisma, Product } from '@prisma/client';

export type RemovalOutcome = 'deleted' | 'archived';
export function countOrderLines(
  tx: Prisma.TransactionClient,
  productId: number,
): Promise<number> {
  return tx.orderItem.count({ where: { productId } });
}
/** Keep products referenced by sales history; the caller owns the transaction. */
export async function removeProduct(
  tx: Prisma.TransactionClient,
  product: Product,
  options: { detachCategory?: boolean } = {},
): Promise<RemovalOutcome> {
  if ((await countOrderLines(tx, product.id)) === 0) {
    await tx.product.delete({ where: { id: product.id } });
    return 'deleted';
  }
  await tx.product.update({
    where: { id: product.id },
    data: {
      archivedAt: new Date(),
      isAvailable: false,
      ...(options.detachCategory ? { categoryId: null } : {}),
    },
  });
  return 'archived';
}
