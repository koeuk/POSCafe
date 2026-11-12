import { PaymentStatus as PrismaPaymentStatus } from '@prisma/client';

export const PaymentStatus = {
  UNPAID: PrismaPaymentStatus.unpaid,
  PAID: PrismaPaymentStatus.paid,
  REFUNDED: PrismaPaymentStatus.refunded,
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
