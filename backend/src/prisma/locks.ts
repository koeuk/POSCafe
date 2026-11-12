import { Prisma } from '@prisma/client';

/** Lock only the row, then load through Prisma so booleans/decimals retain their types. */
export async function lockProduct(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT id FROM products WHERE id = ${id} FOR UPDATE`;
  return tx.product.findUnique({ where: { id } });
}

export async function lockOrder(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`;
  return tx.order.findUnique({ where: { id } });
}

export async function lockInventoryItem(
  tx: Prisma.TransactionClient,
  id: number,
) {
  await tx.$queryRaw`SELECT id FROM inventory_items WHERE id = ${id} FOR UPDATE`;
  return tx.inventoryItem.findUnique({ where: { id } });
}
