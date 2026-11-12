import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  create(dto: CreateInventoryItemDto) {
    return this.prisma.inventoryItem.create({ data: dto });
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
      const saved = await tx.inventoryItem.update({ where: { id }, data: dto });
      const after = Number(saved.stockQuantity);
      if (dto.stockQuantity !== undefined && after !== before) {
        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: id,
            delta: after - before,
            stockAfter: after,
            reason: 'correction',
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
      const before = Number(item.stockQuantity);
      const after = Math.max(0, before + dto.delta);
      const saved = await tx.inventoryItem.update({
        where: { id },
        data: { stockQuantity: after },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: id,
          delta: Number(saved.stockQuantity) - before,
          stockAfter: saved.stockQuantity,
          reason: dto.reason || (dto.delta >= 0 ? 'restock' : 'correction'),
          userId,
        },
      });
      return saved;
    });
  }
  findMovements(limit = 50) {
    return this.prisma.inventoryMovement.findMany({
      include: { inventoryItem: true, user: { omit: { password: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
