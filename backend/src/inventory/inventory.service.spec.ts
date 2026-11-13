import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Inventory controls', () => {
  const movement = jest.fn();
  const update = jest.fn(({ data }: { data: Record<string, unknown> }) => ({
    id: 7,
    stockQuantity: 10,
    ...data,
  }));
  const tx = {
    $queryRaw: jest.fn(),
    inventoryItem: {
      create: jest.fn().mockResolvedValue({ id: 7, stockQuantity: 10 }),
      findUnique: jest.fn().mockResolvedValue({ id: 7, stockQuantity: 10 }),
      update,
    },
    inventoryMovement: { create: movement },
  };
  const service = new InventoryService({
    $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
  } as unknown as PrismaService);
  beforeEach(() => jest.clearAllMocks());
  it('journals opening stock with actor', async () => {
    await service.create(
      { name: 'Milk', category: 'Raw Materials', unit: 'L', stockQuantity: 10 },
      3,
    );
    expect(movement).toHaveBeenCalledWith({
      data: {
        inventoryItemId: 7,
        delta: 10,
        stockAfter: 10,
        reason: 'opening_balance',
        userId: 3,
      },
    });
  });
  it('rejects unexplained quantity edits without writing', async () => {
    await expect(
      service.update(7, { stockQuantity: 6 }, 3),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
  it('records the actual difference and trimmed reason', async () => {
    await service.update(
      7,
      { stockQuantity: 6, adjustmentReason: ' Spillage ' },
      3,
    );
    expect(movement).toHaveBeenCalledWith({
      data: {
        inventoryItemId: 7,
        delta: -4,
        stockAfter: 6,
        reason: 'Spillage',
        userId: 3,
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { stockQuantity: 6 },
    });
  });
  it('allows cost-only edits without a quantity movement', async () => {
    await service.update(7, { costPerUnit: 2 }, 3);
    expect(movement).not.toHaveBeenCalled();
  });
  it('rejects blank restock reasons', async () => {
    await expect(
      service.restock(7, 3, { delta: 5, reason: ' ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
