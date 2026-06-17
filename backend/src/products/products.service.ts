import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    private readonly categoriesService: CategoriesService,
  ) {}

  findAll(categoryId?: number): Promise<Product[]> {
    return this.repo.find({
      where: categoryId ? { categoryId } : {},
      relations: { category: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.repo.findOne({
      where: { id },
      relations: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    // Ensure the category exists (throws NotFound otherwise).
    await this.categoriesService.findOne(dto.categoryId);
    const product = this.repo.create(dto);
    return this.repo.save(product);
  }

  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    if (dto.categoryId !== undefined) {
      await this.categoriesService.findOne(dto.categoryId);
    }
    Object.assign(product, dto);
    return this.repo.save(product);
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);
    await this.repo.remove(product);
  }
}
