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
  const findMany = jest.fn();
  const prismaMock = {
    $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    inventoryItem: {
      findMany,
      fields: { minThreshold: 'minThreshold' },
    },
  };
  const service = new InventoryService(prismaMock as unknown as PrismaService);
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
  it('calculates inventory summary and distinguishes categories', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 1,
        category: 'Raw Materials',
        stockQuantity: 10,
        minThreshold: 12,
        costPerUnit: 2.5,
      },
      {
        id: 2,
        category: 'Raw Materials',
        stockQuantity: 0,
        minThreshold: 1,
        costPerUnit: 10,
      },
      {
        id: 3,
        category: 'Packaging',
        stockQuantity: 5,
        minThreshold: 2,
        costPerUnit: 0,
      },
    ]);

    const res = await service.summary();
    expect(res.total).toBe(3);
    expect(res.lowStock).toBe(1);
    expect(res.outOfStock).toBe(1);
    expect(res.stockValue).toBe(25);
    expect(res.uncostedCount).toBe(1);
    expect(res.byCategory['Raw Materials']).toEqual({
      total: 2,
      lowStock: 1,
      outOfStock: 1,
      stockValue: 25,
      uncostedCount: 0,
    });
    expect(res.byCategory['Packaging']).toEqual({
      total: 1,
      lowStock: 0,
      outOfStock: 0,
      stockValue: 0,
      uncostedCount: 1,
    });
  });
  it('scopes summary to raw ingredients when category is provided', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 1,
        category: 'Raw Materials',
        stockQuantity: 10,
        minThreshold: 12,
        costPerUnit: 2.5,
      },
      {
        id: 2,
        category: 'Raw Materials',
        stockQuantity: 0,
        minThreshold: 1,
        costPerUnit: 10,
      },
    ]);

    const res = await service.summary('Raw Materials');
    expect(findMany).toHaveBeenCalledWith({
      where: { archivedAt: null, category: 'Raw Materials' },
      select: {
        id: true,
        category: true,
        stockQuantity: true,
        minThreshold: true,
        costPerUnit: true,
      },
    });
    expect(res.total).toBe(2);
    expect(res.lowStock).toBe(1);
    expect(res.outOfStock).toBe(1);
    expect(res.stockValue).toBe(25);
    expect(res.uncostedCount).toBe(0);
  });
  it('finds low stock with optional positive-only filter and category', async () => {
    findMany.mockResolvedValueOnce([]);
    await service.findLowStock('Raw Materials', true);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        stockQuantity: { gt: 0, lte: 'minThreshold' },
        category: 'Raw Materials',
      },
      orderBy: { stockQuantity: 'asc' },
    });
  });
});
