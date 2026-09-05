/* eslint-disable @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-return --
   supertest's res.body is `any`; asserting every response shape would bury
   the test in casts without making it safer. */
// One stock mode per product: 'count' keeps a single figure on the product
// (sizes only carry price), 'recipe' is made to order. Every quantity change
// is journaled so the shop owner can explain each number.
process.env.DB_NAME = 'poscafe_test';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_MIGRATIONS_RUN = 'false';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('Stock mode (e2e)', () => {
  let app: INestApplication;
  let http: () => request.Agent;
  let token: string;
  let categoryId: number;
  let cupId: number;

  beforeAll(async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? '3306'),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
    });
    await conn.query('DROP DATABASE IF EXISTS poscafe_test');
    await conn.query('CREATE DATABASE poscafe_test CHARACTER SET utf8mb4');
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

    const reg = await http()
      .post('/auth/register')
      .send({ name: 'Owner', username: 'owner', password: 'original123' })
      .expect(201);
    token = reg.body.accessToken;

    const cat = await http()
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Espresso' })
      .expect(201);
    categoryId = cat.body.id;

    const cup = await http()
      .post('/inventory')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cup', category: 'Packaging', unit: 'pcs', stockQuantity: 7 })
      .expect(201);
    cupId = cup.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const product = async (id: number) =>
    (await auth(http().get(`/products/${id}`)).expect(200)).body;
  const movementsFor = async (id: number) =>
    (await auth(http().get('/products/movements?limit=50')).expect(200)).body.filter(
      (m: any) => m.productId === id,
    );

  const createCounted = async (name: string, stock: number) => {
    const res = await auth(http().post('/products'))
      .send({ name, price: 3.5, categoryId, stock })
      .expect(201);
    return res.body.id as number;
  };

  it('defaults to counted stock, and sizes carry price only', async () => {
    const res = await auth(http().post('/products'))
      .send({
        name: 'Latte',
        price: 3,
        categoryId,
        stock: 50,
        sizes: [
          { size: 'S', price: 3 },
          { size: 'L', price: 4 },
        ],
      })
      .expect(201);
    expect(res.body.stockMode).toBe('count');
    expect(res.body.stock).toBe(50);
    expect(res.body.variants.map((v: any) => v.size)).toEqual(['S', 'L']);
    expect(res.body.variants[0]).not.toHaveProperty('stock');
    expect(res.body.recipes).toEqual([]);
  });

  it('rejects a stock figure on a size row', async () => {
    await auth(http().post('/products'))
      .send({
        name: 'Nope',
        price: 3,
        categoryId,
        sizes: [{ size: 'S', price: 3, stock: 4 }],
      })
      .expect(400);
  });

  it('keeps the counted stock when a product gains or loses sizes', async () => {
    const id = await createCounted('Mocha', 40);
    await auth(http().patch(`/products/${id}`))
      .send({ sizes: [{ size: 'M', price: 3.5 }] })
      .expect(200);
    expect((await product(id)).stock).toBe(40);

    await auth(http().patch(`/products/${id}`)).send({ sizes: [] }).expect(200);
    expect((await product(id)).stock).toBe(40);
    // Only the creation is journaled: nothing about the stock changed.
    expect(await movementsFor(id)).toEqual([
      expect.objectContaining({ delta: 40, stockAfter: 40 }),
    ]);
  });

  it('journals a manual stock change', async () => {
    const id = await createCounted('Drip', 25);
    await auth(http().patch(`/products/${id}`)).send({ stock: 30 }).expect(200);
    expect((await product(id)).stock).toBe(30);
    expect((await movementsFor(id))[0]).toEqual(
      expect.objectContaining({ delta: 5, stockAfter: 30 }),
    );
  });

  it('switching to made-to-order clears the counted stock, journaled', async () => {
    const id = await createCounted('Flat White', 12);
    const res = await auth(http().patch(`/products/${id}`))
      .send({ stockMode: 'recipe' })
      .expect(200);
    expect(res.body.stockMode).toBe('recipe');
    expect(res.body.stock).toBe(0);
    expect((await movementsFor(id))[0]).toEqual(
      expect.objectContaining({ delta: -12, stockAfter: 0 }),
    );
  });

  it('ignores a stock figure sent for a made-to-order product', async () => {
    const res = await auth(http().post('/products'))
      .send({ name: 'Cortado', price: 3, categoryId, stockMode: 'recipe', stock: 9 })
      .expect(201);
    expect(res.body.stock).toBe(0);
    expect(await movementsFor(res.body.id)).toEqual([]);
  });

  it('saving a recipe makes the product made to order', async () => {
    const id = await createCounted('Americano', 8);
    await auth(http().post('/recipes'))
      .send({ productId: id, items: [{ inventoryItemId: cupId, quantity: 1 }] })
      .expect(201);
    const p = await product(id);
    expect(p.stockMode).toBe('recipe');
    expect(p.stock).toBe(0);
    expect(p.recipes).toEqual([{ size: null, servings: 7 }]);
    expect((await movementsFor(id))[0]).toEqual(
      expect.objectContaining({ delta: -8, stockAfter: 0 }),
    );
  });

  it('switching back to counted stock drops the recipes', async () => {
    const id = await createCounted('Espresso', 0);
    await auth(http().post('/recipes'))
      .send({ productId: id, items: [{ inventoryItemId: cupId, quantity: 1 }] })
      .expect(201);
    await auth(http().patch(`/products/${id}`))
      .send({ stockMode: 'count', stock: 3 })
      .expect(200);
    const p = await product(id);
    expect(p.stockMode).toBe('count');
    expect(p.stock).toBe(3);
    expect(p.recipes).toEqual([]);
    const recipes = (await auth(http().get(`/recipes/product/${id}`))).body;
    expect(recipes).toEqual([]);
  });

  it('refuses to sell a made-to-order size that has no recipe', async () => {
    const res = await auth(http().post('/products'))
      .send({
        name: 'Matcha',
        price: 4,
        categoryId,
        stockMode: 'recipe',
        sizes: [
          { size: 'S', price: 4 },
          { size: 'L', price: 5 },
        ],
      })
      .expect(201);
    await auth(http().post('/recipes'))
      .send({
        productId: res.body.id,
        size: 'S',
        items: [{ inventoryItemId: cupId, quantity: 1 }],
      })
      .expect(201);
    await auth(http().post('/orders'))
      .send({ items: [{ productId: res.body.id, size: 'S', quantity: 1 }] })
      .expect(201);
    const denied = await auth(http().post('/orders'))
      .send({ items: [{ productId: res.body.id, size: 'L', quantity: 1 }] })
      .expect(400);
    expect(denied.body.message).toMatch(/no recipe/);
  });
});
