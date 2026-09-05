/**
 * Deleting products and categories (e2e): nothing with sales history is
 * ever destroyed — it is archived out of the catalog instead, and only when
 * the caller asks for it with ?force=true.
 */
process.env.DB_NAME = 'poscafe_test_catalog';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_MIGRATIONS_RUN = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('Catalog delete (e2e)', () => {
  let app: INestApplication;
  let http: () => request.Agent;
  let token: string;
  let coffeeId: number;
  let soldId: number; // product with an order
  let freshId: number; // product never sold
  let orderId: number;

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? '3306'),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
    });
    await conn.query('DROP DATABASE IF EXISTS poscafe_test_catalog');
    await conn.query(
      'CREATE DATABASE poscafe_test_catalog CHARACTER SET utf8mb4',
    );
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
    http = () => request(app.getHttpServer());

    const res = await http()
      .post('/auth/register')
      .send({ name: 'Boss', username: 'boss', password: 'secret123' })
      .expect(201);
    token = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sets up a category with a sold and an unsold product', async () => {
    coffeeId = (
      await auth(http().post('/categories'))
        .send({ name: 'Coffee' })
        .expect(201)
    ).body.id;
    soldId = (
      await auth(http().post('/products'))
        .send({ name: 'Latte', price: 3, categoryId: coffeeId, stock: 10 })
        .expect(201)
    ).body.id;
    freshId = (
      await auth(http().post('/products'))
        .send({ name: 'Mocha', price: 3.5, categoryId: coffeeId, stock: 10 })
        .expect(201)
    ).body.id;
    orderId = (
      await auth(http().post('/orders'))
        .send({ items: [{ productId: soldId, quantity: 1 }] })
        .expect(201)
    ).body.id;
  });

  it('deletes an unsold product outright', async () => {
    await auth(http().delete(`/products/${freshId}`)).expect(204);
    await auth(http().get(`/products/${freshId}`)).expect(404);
  });

  it('refuses to delete a sold product without force, explaining why', async () => {
    const res = await auth(http().delete(`/products/${soldId}`)).expect(409);
    expect(res.body.message).toMatch(/1 past order line/);
    expect(res.body.message).toMatch(/archives/i);
  });

  it('force-deleting a sold product archives it but keeps order history', async () => {
    await auth(http().delete(`/products/${soldId}?force=true`)).expect(204);

    const list = (await auth(http().get('/products')).expect(200)).body;
    expect(list.map((p: { id: number }) => p.id)).not.toContain(soldId);

    const menu = (await http().get('/menu').expect(200)).body;
    expect(
      menu.flatMap((c: { products: { id: number }[] }) =>
        c.products.map((p) => p.id),
      ),
    ).not.toContain(soldId);
    await http().get(`/menu/product/${soldId}`).expect(404);

    const stock = (await auth(http().get('/reports/stock')).expect(200)).body;
    expect(JSON.stringify(stock)).not.toContain('"Latte"');

    const order = (await auth(http().get(`/orders/${orderId}`)).expect(200))
      .body;
    expect(order.items[0].product.name).toBe('Latte');
    expect(order.items[0].product.archivedAt).toBeTruthy();

    // Idempotent: deleting an archived product again is a no-op.
    await auth(http().delete(`/products/${soldId}?force=true`)).expect(204);
  });

  it('refuses to delete a category that still holds products', async () => {
    const teaId = (
      await auth(http().post('/categories')).send({ name: 'Tea' }).expect(201)
    ).body.id;
    const chaiId = (
      await auth(http().post('/products'))
        .send({ name: 'Chai', price: 2, categoryId: teaId, stock: 5 })
        .expect(201)
    ).body.id;
    await auth(http().post('/orders'))
      .send({ items: [{ productId: chaiId, quantity: 2 }] })
      .expect(201);
    await auth(http().post('/products'))
      .send({ name: 'Green Tea', price: 2, categoryId: teaId, stock: 5 })
      .expect(201);

    const res = await auth(http().delete(`/categories/${teaId}`)).expect(409);
    expect(res.body.message).toMatch(/2 products/);

    // Coffee holds only the archived Latte now — still a blocker without force.
    const res2 = await auth(http().delete(`/categories/${coffeeId}`)).expect(
      409,
    );
    expect(res2.body.message).toMatch(/1 archived product/);
  });

  it('force-deleting a category removes its products the same way', async () => {
    const cats = (await auth(http().get('/categories')).expect(200)).body;
    const teaId = cats.find((c: { name: string }) => c.name === 'Tea').id;

    await auth(http().delete(`/categories/${teaId}?force=true`)).expect(204);
    await auth(http().get(`/categories/${teaId}`)).expect(404);

    const names = (await auth(http().get('/products')).expect(200)).body.map(
      (p: { name: string }) => p.name,
    );
    expect(names).not.toContain('Chai'); // archived (had an order)
    expect(names).not.toContain('Green Tea'); // deleted (never sold)

    // The archived Chai lives on in its order, now without a category.
    const orders = (await auth(http().get('/orders')).expect(200)).body;
    const chaiLine = orders
      .flatMap(
        (o: {
          items: { product: { name: string; categoryId: number | null } }[];
        }) => o.items,
      )
      .find((i: { product: { name: string } }) => i.product.name === 'Chai');
    expect(chaiLine.product.categoryId).toBeNull();

    // And the category holding only an archived product can be forced too.
    await auth(http().delete(`/categories/${coffeeId}?force=true`)).expect(204);
  });
});
