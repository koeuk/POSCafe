import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { CreateProductDto, ProductSizeDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductVariant } from './entities/product-variant.entity';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    private readonly categoriesService: CategoriesService,
  ) {}

  findAll(categoryId?: number): Promise<Product[]> {
    return this.repo.find({
      where: categoryId ? { categoryId } : {},
      relations: { category: true, variants: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.repo.findOne({
      where: { id },
      relations: { category: true, variants: true },
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
    const saved = await this.repo.save(product);
    await this.syncVariants(saved.id, dto.sizes ?? null);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    if (dto.categoryId !== undefined) {
      await this.categoriesService.findOne(dto.categoryId);
    }
    Object.assign(product, dto);
    await this.repo.save(product);
    // Only reconcile stock variants when sizes were part of the update.
    if (dto.sizes !== undefined) {
      await this.syncVariants(id, dto.sizes);
    }
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);
    await this.repo.remove(product); // variants cascade-delete
  }

  /**
   * Reconciles the per-size stock rows to match the product's size options:
   * upserts each size (preserving existing stock when the DTO omits it) and
   * removes variants for sizes that no longer exist.
   */
  private async syncVariants(
    productId: number,
    sizes: ProductSizeDto[] | null,
  ): Promise<void> {
    const existing = await this.variantRepo.find({ where: { productId } });
    const wanted = sizes ?? [];
    const wantedSizes = new Set(wanted.map((s) => s.size));

    // Delete variants whose size was removed (or all, if sizes cleared).
    const toRemove = existing.filter((v) => !wantedSizes.has(v.size));
    if (toRemove.length) {
      await this.variantRepo.remove(toRemove);
    }

    // Upsert each wanted size.
    for (const s of wanted) {
      const current = existing.find((v) => v.size === s.size);
      if (current) {
        current.price = s.price;
        if (s.stock !== undefined) current.stock = s.stock;
        await this.variantRepo.save(current);
      } else {
        await this.variantRepo.save(
          this.variantRepo.create({
            productId,
            size: s.size,
            price: s.price,
            stock: s.stock ?? 0,
          }),
        );
      }
    }
  }
}
