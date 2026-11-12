import type { Prisma, User as PrismaUser } from '@prisma/client';

export type PublicUser = Omit<PrismaUser, 'password'>;
export type OrderWithDetails = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: true } };
    user: { omit: { password: true } };
  };
}>;
export type ProductWithDetails = Prisma.ProductGetPayload<{
  include: { category: true; variants: true };
}>;
export type RecipeWithIngredients = Prisma.RecipeGetPayload<{
  include: { items: { include: { inventoryItem: true } } };
}>;
export type RecipeLineWithIngredient = RecipeWithIngredients['items'][number];
export type StockMode = 'count' | 'recipe';
export const STOCK_MODES: StockMode[] = ['count', 'recipe'];
export interface OrderItemExtra {
  inventoryItemId: number;
  name: string;
  quantity: number;
  unit: string;
}
