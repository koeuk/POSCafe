import { OrderStatus as PrismaOrderStatus } from '@prisma/client';

export const OrderStatus = {
  PENDING: PrismaOrderStatus.pending,
  PREPARING: PrismaOrderStatus.preparing,
  READY: PrismaOrderStatus.ready,
  COMPLETED: PrismaOrderStatus.completed,
  CANCELLED: PrismaOrderStatus.cancelled,
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
