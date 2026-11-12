import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}
  async getMenu() {
    const available = { isAvailable: true, archivedAt: null };
    return this.prisma.category.findMany({
      where: { isActive: true, products: { some: available } },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        products: {
          where: available,
          include: { variants: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
  async getProduct(id: number) {
    const product = await this.prisma.product.findFirst({
      where: { id, isAvailable: true, archivedAt: null },
      include: { category: true, variants: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!product) throw new NotFoundException(`Product #${id} not found`);
    return product;
  }
}
