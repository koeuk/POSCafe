import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RecipeItem } from '../recipes/entities/recipe-item.entity';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { RestockInventoryItemDto } from './dto/restock-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepo: Repository<InventoryMovement>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(category?: string): Promise<InventoryItem[]> {
    const where = category ? { category } : {};
    return this.itemRepo.find({
      where,
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async findLowStock(): Promise<InventoryItem[]> {
    return this.itemRepo
      .createQueryBuilder('item')
      .where('item.stockQuantity <= item.minThreshold')
      .orderBy('item.stockQuantity', 'ASC')
      .getMany();
  }

  async findOne(id: number): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Inventory item #${id} not found`);
    }
    return item;
  }

  async create(dto: CreateInventoryItemDto): Promise<InventoryItem> {
    const item = this.itemRepo.create({
      name: dto.name,
      category: dto.category,
      unit: dto.unit,
      stockQuantity: dto.stockQuantity,
      minThreshold: dto.minThreshold ?? 0,
      costPerUnit: dto.costPerUnit ?? 0,
    });
    return this.itemRepo.save(item);
  }

  /**
   * Edits an item's details. A changed quantity is journaled as a correction
   * so the movement feed explains every number, not just restocks.
   */
  async update(
    id: number,
    dto: UpdateInventoryItemDto,
    userId: number | null = null,
  ): Promise<InventoryItem> {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(InventoryItem, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) {
        throw new NotFoundException(`Inventory item #${id} not found`);
      }
      const before = Number(item.stockQuantity);
      Object.assign(item, dto);
      const saved = await manager.save(item);
      const after = Number(saved.stockQuantity);
      if (dto.stockQuantity !== undefined && after !== before) {
        await manager.save(
          manager.create(InventoryMovement, {
            inventoryItemId: item.id,
            delta: after - before,
            stockAfter: after,
            reason: 'correction',
            userId,
          }),
        );
      }
      return saved;
    });
  }

  /**
   * Deletes an item. Refused while a recipe still uses it — otherwise the
   * cascade would silently empty that recipe and flip its product back to
   * stock counting.
   */
  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    const uses = await this.dataSource.getRepository(RecipeItem).find({
      where: { inventoryItemId: id },
      relations: { recipe: { product: true } },
    });
    if (uses.length > 0) {
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
    await this.itemRepo.remove(item);
  }

  async restock(
    id: number,
    userId: number,
    dto: RestockInventoryItemDto,
  ): Promise<InventoryItem> {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(InventoryItem, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) {
        throw new NotFoundException(`Inventory item #${id} not found`);
      }

      // Stock can't go negative; journal the change actually applied, not
      // the one requested, so delta and stockAfter always agree.
      const before = Number(item.stockQuantity);
      const after = Math.max(0, before + dto.delta);
      item.stockQuantity = after;

      const saved = await manager.save(item);

      const movement = manager.create(InventoryMovement, {
        inventoryItemId: item.id,
        delta: after - before,
        stockAfter: saved.stockQuantity,
        reason: dto.reason || (dto.delta >= 0 ? 'restock' : 'correction'),
        userId,
      });
      await manager.save(movement);

      return saved;
    });
  }

  async findMovements(limit = 50): Promise<InventoryMovement[]> {
    return this.movementRepo.find({
      relations: { inventoryItem: true, user: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
