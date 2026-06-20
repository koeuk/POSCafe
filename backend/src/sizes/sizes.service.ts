import {
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CreateSizeDto } from './dto/create-size.dto';
import { UpdateSizeDto } from './dto/update-size.dto';
import { Size } from './entities/size.entity';

// Defaults seeded on first run (when the table is empty).
const DEFAULT_SIZES = ['Small', 'Medium', 'Large'];

@Injectable()
export class SizesService implements OnModuleInit {
  constructor(
    @InjectRepository(Size)
    private readonly repo: Repository<Size>,
  ) {}

  // Seed Small / Medium / Large the first time, so the list isn't empty.
  async onModuleInit() {
    if ((await this.repo.count()) === 0) {
      await this.repo.save(
        DEFAULT_SIZES.map((name, i) =>
          this.repo.create({ name, sortOrder: i }),
        ),
      );
    }
  }

  findAll(): Promise<Size[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async create(dto: CreateSizeDto): Promise<Size> {
    const name = dto.name.trim();
    if (await this.repo.findOne({ where: { name } })) {
      throw new ConflictException(`Size "${name}" already exists`);
    }
    return this.repo.save(
      this.repo.create({ name, sortOrder: dto.sortOrder ?? 0 }),
    );
  }

  async update(id: number, dto: UpdateSizeDto): Promise<Size> {
    const size = await this.repo.findOne({ where: { id } });
    if (!size) throw new NotFoundException('Size not found');
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const clash = await this.repo.findOne({ where: { name, id: Not(id) } });
      if (clash) throw new ConflictException(`Size "${name}" already exists`);
      size.name = name;
    }
    if (dto.sortOrder !== undefined) size.sortOrder = dto.sortOrder;
    return this.repo.save(size);
  }

  async remove(id: number): Promise<void> {
    const size = await this.repo.findOne({ where: { id } });
    if (!size) throw new NotFoundException('Size not found');
    await this.repo.remove(size);
  }
}
