import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeProduct } from '../products/product-removal';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}
  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }
  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException(`Category #${id} not found`);
    return category;
  }
  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }
  async update(id: number, dto: UpdateCategoryDto) {
    await this.findOne(id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }
  async remove(id: number, force = false): Promise<void> {
    const category = await this.findOne(id);
    await this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { categoryId: id } });
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
      for (const product of products) {
        if (product.archivedAt)
          await tx.product.update({
            where: { id: product.id },
            data: { categoryId: null },
          });
        else await removeProduct(tx, product, { detachCategory: true });
      }
      await tx.category.delete({ where: { id } });
    });
  }
}
