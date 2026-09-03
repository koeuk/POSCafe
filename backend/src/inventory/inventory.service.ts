import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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

  async update(id: number, dto: UpdateInventoryItemDto): Promise<InventoryItem> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
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

      item.stockQuantity = Number(item.stockQuantity) + dto.delta;
      if (item.stockQuantity < 0) item.stockQuantity = 0;

      const saved = await manager.save(item);

      const movement = manager.create(InventoryMovement, {
        inventoryItemId: item.id,
        delta: dto.delta,
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
