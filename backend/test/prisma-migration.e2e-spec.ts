/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- supertest JSON response assertions. */
import { applyTestSchema } from './database';
process.env.DB_NAME = 'poscafe_test_prisma';
process.env.DATABASE_URL = '';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(30000);

describe('Prisma migration compatibility', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: number;
  let productId: number;
  let orderId: number;
  const http = () => request(app.getHttpServer());
  const authorized = (r: request.Test) =>
    r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
    });
    await conn.query('DROP DATABASE IF EXISTS poscafe_test_prisma');
    await conn.query(
      'CREATE DATABASE poscafe_test_prisma CHARACTER SET utf8mb4',
    );
    await applyTestSchema(conn);
    await conn.end();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('serializes first-user registration even when users is empty', async () => {
    const results = await Promise.all(
      ['one', 'two'].map((username) =>
        http()
          .post('/auth/register')
          .send({ name: username, username, password: 'secret123' }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 403]);
    const winner = results.find((r) => r.status === 201)!;
    token = winner.body.accessToken;
    userId = winner.body.user.id;
    expect(await prisma.user.count()).toBe(1);
  });

  it('preserves legacy local DATETIME instants and writes new dates in the same convention', async () => {
    await prisma.$executeRaw`UPDATE users SET createdAt = '2024-01-02 10:00:00' WHERE id = ${userId}`;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.createdAt.getTime()).toBe(new Date(2024, 0, 2, 10).getTime());
    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { name: 'Owner', updatedAt: now },
    });
    const rows = await prisma.$queryRaw<
      { wall: string }[]
    >`SELECT DATE_FORMAT(updatedAt, '%Y-%m-%d %H:%i') AS wall FROM users WHERE id = ${userId}`;
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    expect(rows[0].wall).toBe(expected);
  });

  it('never exposes password hashes in users or nested stock movement responses', async () => {
    const users = await authorized(http().get('/users')).expect(200);
    expect(users.body[0]).not.toHaveProperty('password');
    const category = await authorized(http().post('/categories'))
      .send({ name: 'Concurrent checkout' })
      .expect(201);
    const product = await authorized(http().post('/products'))
      .send({
        name: 'Last muffin',
        categoryId: category.body.id,
        price: 2.5,
        stock: 1,
      })
      .expect(201);
    productId = product.body.id;
    const movements = await authorized(
      http().get('/products/movements'),
    ).expect(200);
    expect(movements.body[0].user).not.toHaveProperty('password');
  });

  it('allows only one concurrent checkout to reserve the last unit', async () => {
    const results = await Promise.all(
      [1, 2].map(() =>
        authorized(http().post('/orders')).send({
          items: [{ productId, quantity: 1 }],
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    const order = results.find((r) => r.status === 201)!;
    orderId = order.body.id;
    expect(order.body.user).not.toHaveProperty('password');
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
        .stock,
    ).toBe(0);
    expect(await prisma.order.count()).toBe(1);
  });

  it('records one payment and includes it in the local day reports', async () => {
    const results = await Promise.all(
      [1, 2].map(() =>
        authorized(http().post('/payments')).send({
          orderId,
          method: 'cash',
          tendered: 5,
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.payment.count()).toBe(1);
    const summary = await authorized(http().get('/reports/summary')).expect(
      200,
    );
    const daily = await authorized(http().get('/reports/daily-sales')).expect(
      200,
    );
    const close = await authorized(http().get('/reports/day-close')).expect(
      200,
    );
    expect(summary.body.today.revenue).toBe(2.5);
    expect(daily.body[0].revenue).toBe(2.5);
    expect(close.body.totals.revenue).toBe(2.5);
  });

  it('refunds a payment once and returns exactly one stock unit', async () => {
    const results = await Promise.all(
      [1, 2].map(() => authorized(http().post(`/orders/${orderId}/refund`))),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
        .stock,
    ).toBe(1);
  });

  it('refreshes settings updatedAt automatically', async () => {
    await prisma.$executeRaw`UPDATE app_settings SET updatedAt = '2024-01-01 00:00:00' WHERE id = 1`;
    const result = await authorized(http().patch('/settings'))
      .send({ appName: 'Prisma Cafe' })
      .expect(200);
    expect(new Date(result.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(2024, 0, 1).getTime(),
    );
  });
});
