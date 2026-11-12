import { Role as PrismaRole } from '@prisma/client';

export const Role = {
  ADMIN: PrismaRole.admin,
  CASHIER: PrismaRole.cashier,
} as const;
export type Role = (typeof Role)[keyof typeof Role];
