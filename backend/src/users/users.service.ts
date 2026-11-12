import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

export interface CreateUserData {
  name: string;
  username: string;
  password: string; // already hashed
  email?: string | null;
  role?: Role;
  avatar?: string | null;
  allowedPages?: string[] | null;
}
export interface NewUserInput extends Omit<CreateUserData, 'role'> {
  password: string; // plain text — hashed here
  role: Role;
}
function normalizeEmail(email: string | null | undefined): string | null {
  return email?.trim().toLowerCase() || null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany();
  }
  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }
  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }
  findByUsernameWithPassword(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      omit: { password: false },
    });
  }

  private async identifierId(identifier: string): Promise<number | null> {
    const value = identifier.trim();
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM users WHERE username = ${value} OR LOWER(email) = LOWER(${value}) LIMIT 1`;
    return rows[0]?.id ?? null;
  }
  async findByIdentifierWithPassword(identifier: string) {
    const id = await this.identifierId(identifier);
    return id === null
      ? null
      : this.prisma.user.findUnique({
          where: { id },
          omit: { password: false },
        });
  }
  async findByIdentifier(identifier: string) {
    const id = await this.identifierId(identifier);
    return id === null ? null : this.findById(id);
  }
  async findByEmail(email: string) {
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${email.trim()}) LIMIT 1`;
    return rows[0] ? this.findById(rows[0].id) : null;
  }
  async setPassword(id: number, password: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { password: await bcrypt.hash(password, 10) },
    });
  }
  create(data: CreateUserData) {
    return this.prisma.user.create({
      data: {
        ...data,
        allowedPages:
          data.allowedPages === null ? Prisma.DbNull : data.allowedPages,
      },
    });
  }

  /** The singleton settings row serializes even registrations against an empty users table. */
  async createSelfSignup(data: {
    name: string;
    username: string;
    password: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      });
      await tx.$queryRaw`SELECT id FROM app_settings WHERE id = 1 FOR UPDATE`;
      if (await tx.user.count()) {
        throw new ForbiddenException(
          'Registration is closed — ask an admin to create your account',
        );
      }
      return tx.user.create({ data: { ...data, role: Role.ADMIN } });
    });
  }

  async createUser(input: NewUserInput) {
    if (await this.findByUsername(input.username))
      throw new ConflictException('Username already taken');
    const email = normalizeEmail(input.email);
    if (email && (await this.findByEmail(email)))
      throw new ConflictException('Email already in use');
    try {
      return await this.create({
        ...input,
        email,
        password: await bcrypt.hash(input.password, 10),
        allowedPages: input.role === Role.CASHIER ? input.allowedPages : null,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Username or email already in use');
      }
      throw error;
    }
  }

  async updateUser(id: number, dto: UpdateUserDto) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (
      dto.username &&
      dto.username !== user.username &&
      (await this.findByUsername(dto.username))
    ) {
      throw new ConflictException('Username already taken');
    }
    const email =
      dto.email === undefined ? undefined : normalizeEmail(dto.email);
    if (email) {
      const existing = await this.findByEmail(email);
      if (existing && existing.id !== id)
        throw new ConflictException('Email already in use');
    }
    const { password, allowedPages, ...fields } = dto;
    return this.prisma.user.update({
      where: { id },
      data: {
        ...fields,
        email,
        password: password ? await bcrypt.hash(password, 10) : undefined,
        allowedPages:
          dto.role === Role.ADMIN || allowedPages === null
            ? Prisma.DbNull
            : allowedPages,
      },
    });
  }
  async deleteUser(id: number): Promise<void> {
    if (!(await this.findById(id)))
      throw new NotFoundException('User not found');
    const orders = await this.prisma.order.count({ where: { userId: id } });
    if (orders > 0)
      throw new ConflictException(
        `This user has ${orders} past order${orders === 1 ? '' : 's'} and cannot be deleted`,
      );
    await this.prisma.user.delete({ where: { id } });
  }
  count() {
    return this.prisma.user.count();
  }
}
