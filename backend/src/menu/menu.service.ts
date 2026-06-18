import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';

/**
 * Public, read-only view of the menu for customers (scan-to-view).
 * Returns active categories that have at least one available product.
 */
@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async getMenu() {
    const categories = await this.categoryRepo.find({
      where: { isActive: true },
      relations: { products: true },
      order: { name: 'ASC' },
    });

    return categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        image: category.image,
        products: (category.products ?? [])
          .filter((product) => product.isAvailable)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((category) => category.products.length > 0);
  }
}
