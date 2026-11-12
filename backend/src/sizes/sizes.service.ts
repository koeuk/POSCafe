import {
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSizeDto } from './dto/create-size.dto';
import { UpdateSizeDto } from './dto/update-size.dto';

@Injectable()
export class SizesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}
  async onModuleInit() {
    if ((await this.prisma.size.count()) === 0) {
      await this.prisma.size.createMany({
        data: ['Small', 'Medium', 'Large'].map((name, sortOrder) => ({
          name,
          sortOrder,
        })),
        skipDuplicates: true,
      });
    }
  }
  findAll() {
    return this.prisma.size.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
  async create(dto: CreateSizeDto) {
    const name = dto.name.trim();
    if (await this.prisma.size.findUnique({ where: { name } }))
      throw new ConflictException(`Size "${name}" already exists`);
    return this.prisma.size.create({
      data: { name, sortOrder: dto.sortOrder ?? 0 },
    });
  }
  async update(id: number, dto: UpdateSizeDto) {
    if (!(await this.prisma.size.findUnique({ where: { id } })))
      throw new NotFoundException('Size not found');
    const name = dto.name?.trim();
    if (
      name !== undefined &&
      (await this.prisma.size.findFirst({ where: { name, id: { not: id } } }))
    )
      throw new ConflictException(`Size "${name}" already exists`);
    return this.prisma.size.update({
      where: { id },
      data: { name, sortOrder: dto.sortOrder },
    });
  }
  async remove(id: number): Promise<void> {
    if (!(await this.prisma.size.findUnique({ where: { id } })))
      throw new NotFoundException('Size not found');
    await this.prisma.size.delete({ where: { id } });
  }
}
