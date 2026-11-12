import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { databaseUrl, loadDatabaseEnv } from './database.config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    loadDatabaseEnv();
    super({
      adapter: new PrismaMariaDb(databaseUrl()),
      // Also applies to nested user relations (orders and movement feeds).
      // Login queries explicitly opt in to the password field.
      omit: { user: { password: true } },
      transactionOptions: {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10000,
        timeout: 15000,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
