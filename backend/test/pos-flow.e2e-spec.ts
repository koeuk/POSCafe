/* eslint-disable @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-return --
   supertest's res.body is `any`; asserting every response shape would bury
   the test in casts without making it safer. */
// End-to-end coverage of the money paths: auth bootstrap, sized-product
// checkout (pricing, discounts, stock), payment (change, paid+completed),
// refund (permissions, restock, revenue exclusion) and the day-close report.
//
// Runs against a throwaway MySQL database (poscafe_test_pos) that is dropped and
// recreated on every run (one database per suite so parallel Jest
// workers never clobber each other); the app builds its schema there via synchronize.
process.env.DB_NAME = 'poscafe_test_pos';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_MIGRATIONS_RUN = 'false';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('POS flow (e2e)', () => {
  let app: INestApplication;
  let http: () => request.Agent;
  let adminToken: string;
  let cashierToken: string;
  let latteId: number; // sized product (10% off, S/M/L)
  let muffinId: number; // sizeless product

  beforeAll(async () => {
    // Fresh database for a deterministic run.
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? '3306'),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
    });
    await conn.query('DROP DATABASE IF EXISTS poscafe_test_pos');
    await conn.query('CREATE DATABASE poscafe_test_pos CHARACTER SET utf8mb4');
    await conn.end();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    // Mirror the global pipes from main.ts so validation behaves identically.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    http = () => request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it('bootstraps: first registered user becomes admin', async () => {
    const res = await http()
      .post('/auth/register')
      .send({ name: 'Boss', username: 'boss', password: 'secret123' })
      .expect(201);
    expect(res.body.user.role).toBe('admin');
    adminToken = res.body.accessToken;
  });

  it('rejects a second self-signup after bootstrap', async () => {
    await http()
      .post('/auth/register')
      .send({ name: 'Mallory', username: 'mallory', password: 'secret123' })
      .expect(403);
  });

  it('admin creates a cashier account', async () => {
    await http()
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cashier One',
        username: 'cash1',
        password: 'secret123',
        role: 'cashier',
        // Default cashier pages plus the payments grant used below.
        allowedPages: ['pos', 'orders', 'order-history', 'payments'],
      })
      .expect(201);
    const login = await http()
      .post('/auth/login')
      .send({ username: 'cash1', password: 'secret123' })
      .expect(200);
    cashierToken = login.body.accessToken;
  });

  it('sets up the catalog: category + sized and sizeless products', async () => {
    const cat = await http()
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Coffee' })
      .expect(201);

    const latte = await http()
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Latte',
        price: 3,
        discountPercent: 10,
        categoryId: cat.body.id,
        sizes: [
          { size: 'S', price: 3, stock: 10 },
          { size: 'M', price: 3.5, stock: 5 },
          { size: 'L', price: 4, stock: 0 },
        ],
      })
      .expect(201);
    latteId = latte.body.id;
    expect(latte.body.variants).toHaveLength(3);
    expect(latte.body.variants.map((v: { size: string }) => v.size)).toEqual([
      'S',
      'M',
      'L',
    ]);

    const muffin = await http()
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Muffin', price: 2.5, categoryId: cat.body.id, stock: 3 })
      .expect(201);
    muffinId = muffin.body.id;
  });

  it('serves the public menu with variants, without auth', async () => {
    const res = await http().get('/menu').expect(200);
    const products = res.body.flatMap(
      (c: { products: unknown[] }) => c.products,
    );
    const latte = products.find((p: { id: number }) => p.id === latteId);
    expect(latte.variants).toHaveLength(3);
  });

  it('requires a size for sized products', async () => {
    await http()
      .post('/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ items: [{ productId: latteId, quantity: 1 }] })
      .expect(400);
  });

  it('rejects an unknown size', async () => {
    await http()
      .post('/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ items: [{ productId: latteId, quantity: 1, size: 'XL' }] })
      .expect(400);
  });

  it('rejects ordering more than the stock on hand', async () => {
    await http()
      .post('/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ items: [{ productId: latteId, quantity: 6, size: 'M' }] })
      .expect(400);
  });

  let orderId: number;

  it('prices from the variant, applies the discount and decrements stock', async () => {
    const res = await http()
      .post('/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [
          { productId: latteId, quantity: 2, size: 'M', note: 'less sugar' },
          { productId: muffinId, quantity: 1 },
        ],
      })
      .expect(201);
    orderId = res.body.id;

    // M latte: 3.50 − 10% = 3.15 each; muffin 2.50 → total 8.80.
    expect(Number(res.body.total)).toBeCloseTo(8.8, 2);
    const latteLine = res.body.items.find(
      (i: { productId: number }) => i.productId === latteId,
    );
    expect(Number(latteLine.unitPrice)).toBeCloseTo(3.15, 2);
    expect(latteLine.note).toBe('less sugar');

    const product = await http()
      .get(`/products/${latteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const m = product.body.variants.find(
      (v: { size: string }) => v.size === 'M',
    );
    expect(m.stock).toBe(3); // 5 − 2
  });

  it('takes a cash payment: change computed, order paid + completed', async () => {
    const res = await http()
      .post('/payments')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ orderId, method: 'cash', tendered: 10 })
      .expect(201);
    expect(Number(res.body.change)).toBeCloseTo(1.2, 2);

    const order = await http()
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(200);
    expect(order.body.paymentStatus).toBe('paid');
    expect(order.body.status).toBe('completed');
  });

  it('blocks cancelling a paid order', async () => {
    await http()
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ status: 'cancelled' })
      .expect(400);
  });

  it('counts the paid order as revenue', async () => {
    const res = await http()
      .get('/reports/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.allTime.revenue).toBeCloseTo(8.8, 2);
  });

  it('forbids refunds for cashiers', async () => {
    await http()
      .post(`/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(403);
  });

  it('admin refund cancels, restocks and removes the revenue', async () => {
    const res = await http()
      .post(`/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(res.body.paymentStatus).toBe('refunded');
    expect(res.body.status).toBe('cancelled');

    const product = await http()
      .get(`/products/${latteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const m = product.body.variants.find(
      (v: { size: string }) => v.size === 'M',
    );
    expect(m.stock).toBe(5); // restocked

    const summary = await http()
      .get('/reports/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(summary.body.allTime.revenue).toBeCloseTo(0, 2);

    await http()
      .post(`/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400); // no double refund
  });

  it('day close reflects the refund and expects no drawer cash', async () => {
    const res = await http()
      .get('/reports/day-close')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.cashExpected).toBeCloseTo(0, 2);
    expect(res.body.refunds.count).toBe(1);
    expect(res.body.refunds.amount).toBeCloseTo(8.8, 2);
  });

  it('records manual restocks as stock movements', async () => {
    await http()
      .patch(`/products/${muffinId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stock: 20 })
      .expect(200);
    const res = await http()
      .get('/products/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const top = res.body[0];
    expect(top.productId).toBe(muffinId);
    expect(top.stockAfter).toBe(20);
    expect(top.user?.name).toBe('Boss');
  });
});
