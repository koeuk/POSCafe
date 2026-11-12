import { PaymentMethod as PrismaPaymentMethod } from '@prisma/client';

export const PaymentMethod = {
  CASH: PrismaPaymentMethod.cash,
  QR: PrismaPaymentMethod.qr,
  CARD: PrismaPaymentMethod.card,
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
