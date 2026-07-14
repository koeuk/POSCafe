import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';

/**
 * Public, read-only view of the menu for customers (scan-to-view).
 * Returns active categories that have at least one available product.
 */
@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async getMenu() {
    // Only active categories that have at least one available product
    // (inner join drops empties), with available products attached and
    // everything ordered in SQL — no JS post-filtering/sorting.
    const categories = await this.categoryRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.products', 'p', 'p.isAvailable = :available', {
        available: true,
      })
      .where('c.isActive = :active', { active: true })
      .orderBy('c.name', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .getMany();

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      image: category.image,
      products: category.products,
    }));
  }

  /** A single available product with its category, for the detail page. */
  async getProduct(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id, isAvailable: true },
      relations: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }
}
