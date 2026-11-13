import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StockHistoryDto } from './dto/stock-history.dto';
import { PrismaService } from '../prisma/prisma.service';
import { lockInventoryItem } from '../prisma/locks';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { RestockInventoryItemDto } from './dto/restock-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}
  findAll(category?: string) {
    return this.prisma.inventoryItem.findMany({
      where: category ? { category } : {},
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }
  findLowStock() {
    return this.prisma.inventoryItem.findMany({
      where: {
        stockQuantity: { lte: this.prisma.inventoryItem.fields.minThreshold },
      },
      orderBy: { stockQuantity: 'asc' },
    });
  }
  async findOne(id: number) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Inventory item #${id} not found`);
    return item;
  }
  create(dto: CreateInventoryItemDto, userId: number | null = null) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({ data: dto });
      if (Number(item.stockQuantity) > 0) {
        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: item.id,
            delta: item.stockQuantity,
            stockAfter: item.stockQuantity,
            reason: 'opening_balance',
            userId,
          },
        });
      }
      return item;
    });
  }
  async update(
    id: number,
    dto: UpdateInventoryItemDto,
    userId: number | null = null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const item = await lockInventoryItem(tx, id);
      if (!item) throw new NotFoundException(`Inventory item #${id} not found`);
      const before = Number(item.stockQuantity);
      const { adjustmentReason, ...fields } = dto;
      if (
        dto.stockQuantity !== undefined &&
        Number(dto.stockQuantity) !== before &&
        !adjustmentReason?.trim()
      ) {
        throw new BadRequestException(
          'A reason is required when changing stock quantity',
        );
      }
      const saved = await tx.inventoryItem.update({
        where: { id },
        data: fields,
      });
      const after = Number(saved.stockQuantity);
      if (dto.stockQuantity !== undefined && after !== before) {
        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: id,
            delta: after - before,
            stockAfter: after,
            reason: adjustmentReason!.trim(),
            userId,
          },
        });
      }
      return saved;
    });
  }
  async remove(id: number, force = false): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const item = await lockInventoryItem(tx, id);
      if (!item) throw new NotFoundException(`Inventory item #${id} not found`);
      const uses = await tx.recipeItem.findMany({
        where: { inventoryItemId: id },
        include: { recipe: { include: { product: true, items: true } } },
      });
      if (uses.length && !force) {
        const names = [
          ...new Set(
            uses.map((u) =>
              u.recipe.size
                ? `${u.recipe.product.name} (${u.recipe.size})`
                : u.recipe.product.name,
            ),
          ),
        ];
        throw new ConflictException(
          `"${item.name}" is used by the recipe for ${names.join(', ')}. Remove it from those recipes first.`,
        );
      }
      if (
        await tx.inventoryMovement.count({ where: { inventoryItemId: id } })
      ) {
        throw new ConflictException(
          'This item has stock history and cannot be deleted. Keep it for audit history.',
        );
      }
      for (const use of uses) {
        if (use.recipe.items.length === 1)
          await tx.recipe.delete({ where: { id: use.recipeId } });
        else await tx.recipeItem.delete({ where: { id: use.id } });
      }
      await tx.inventoryItem.delete({ where: { id } });
    });
  }
  async restock(id: number, userId: number, dto: RestockInventoryItemDto) {
    return this.prisma.$transaction(async (tx) => {
      const item = await lockInventoryItem(tx, id);
      if (!item) throw new NotFoundException(`Inventory item #${id} not found`);
      if (!dto.reason?.trim())
        throw new BadRequestException('A stock adjustment reason is required');
      const before = Number(item.stockQuantity);
      const after = before + dto.delta;
      if (after < 0)
        throw new BadRequestException(
          'Insufficient stock for this stock-out quantity',
        );
      if (dto.delta === 0)
        throw new BadRequestException('Quantity must change stock');
      const saved = await tx.inventoryItem.update({
        where: { id },
        data: { stockQuantity: after },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: id,
          delta: Number(saved.stockQuantity) - before,
          stockAfter: saved.stockQuantity,
          reason: dto.reason.trim(),
          userId,
        },
      });
      return saved;
    });
  }
  async history(filter: StockHistoryDto) {
    if (filter.from && filter.to && filter.from > filter.to)
      throw new BadRequestException('From date must not be after to date');
    const where: Prisma.InventoryMovementWhereInput = {};
    if (filter.inventoryItemId) where.inventoryItemId = filter.inventoryItemId;
    if (filter.userId) where.userId = filter.userId;
    if (filter.direction === 'in') where.delta = { gt: 0 };
    if (filter.direction === 'out') where.delta = { lt: 0 };
    if (filter.from || filter.to) {
      const end = filter.to ? new Date(`${filter.to}T00:00:00`) : undefined;
      if (end) end.setDate(end.getDate() + 1);
      where.createdAt = {
        ...(filter.from ? { gte: new Date(`${filter.from}T00:00:00`) } : {}),
        ...(end ? { lt: end } : {}),
      };
    }
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.inventoryMovement.count({ where });
        const items = await tx.inventoryMovement.findMany({
          where,
          include: { inventoryItem: true, user: { omit: { password: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (filter.page - 1) * filter.pageSize,
          take: filter.pageSize,
        });
        return { items, total, page: filter.page, pageSize: filter.pageSize };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  findMovements(limit = 50) {
    return this.prisma.inventoryMovement.findMany({
      include: { inventoryItem: true, user: { omit: { password: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }
}
