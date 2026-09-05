import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { removeProduct } from '../products/product-removal';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
    private readonly dataSource: DataSource,
  ) {}

  findAll(): Promise<Category[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.repo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }

  create(dto: CreateCategoryDto): Promise<Category> {
    const category = this.repo.create(dto);
    return this.repo.save(category);
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    Object.assign(category, dto);
    return this.repo.save(category);
  }

  /**
   * Deletes a category. One that still holds products is refused with a 409
   * unless `force` is set, in which case its products go first: those with
   * no sales history are deleted, those with history are archived and
   * detached (see product-removal.ts).
   */
  async remove(id: number, force = false): Promise<void> {
    const category = await this.findOne(id);
    const products = await this.dataSource
      .getRepository(Product)
      .find({ where: { categoryId: id } });
    if (products.length > 0 && !force) {
      const live = products.filter((p) => !p.archivedAt).length;
      const archived = products.length - live;
      const parts = [
        live > 0 ? `${live} product${live === 1 ? '' : 's'}` : null,
        archived > 0
          ? `${archived} archived product${archived === 1 ? '' : 's'}`
          : null,
      ].filter(Boolean);
      throw new ConflictException(
        `"${category.name}" still has ${parts.join(' and ')}. Deleting anyway removes them too: products with sales history are archived and kept in order history, the rest are deleted.`,
      );
    }
    await this.dataSource.transaction(async (manager) => {
      for (const product of products) {
        if (product.archivedAt) {
          product.categoryId = null;
          Reflect.deleteProperty(product, 'category');
          await manager.save(Product, product);
        } else {
          await removeProduct(manager, product, { detachCategory: true });
        }
      }
      await manager.remove(Category, category);
    });
  }
}
