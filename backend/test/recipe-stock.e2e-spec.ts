/**
 * Recipe-driven stock (e2e): a product with a recipe is made to order from
 * consumables; one without draws from its own stock count. Cancel/refund
 * reverse exactly what the sale deducted.
 *
 * Needs a local MySQL (same env vars as the app). Uses its own database.
 */
process.env.DB_NAME = 'poscafe_test_recipes';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_MIGRATIONS_RUN = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('Recipe stock flow (e2e)', () => {
  let app: INestApplication;
  let http: () => request.Agent;
  let token: string;
  let latteId: number; // sized: S stock-counted, M made to order
  let muffinId: number; // sizeless, stock-counted
  let cupId: number;
  let milkId: number;
  let beansId: number;
  let firstOrderId: number;

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const inventory = async (id: number) =>
    Number(
      (await auth(http().get(`/inventory/${id}`)).expect(200)).body
        .stockQuantity,
    );
  const product = async (id: number) =>
    (await auth(http().get(`/products/${id}`)).expect(200)).body;

  beforeAll(async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? '3306'),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
    });
    await conn.query('DROP DATABASE IF EXISTS poscafe_test_recipes');
    await conn.query(
      'CREATE DATABASE poscafe_test_recipes CHARACTER SET utf8mb4',
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

  it('sets up products, consumables and a recipe for one size', async () => {
    const cat = await auth(http().post('/categories'))
      .send({ name: 'Coffee' })
      .expect(201);
    latteId = (
      await auth(http().post('/products'))
        .send({
          name: 'Iced Latte',
          price: 3,
          categoryId: cat.body.id,
          sizes: [
            { size: 'S', price: 3, stock: 3 },
            { size: 'M', price: 3.5, stock: 0 },
          ],
        })
        .expect(201)
    ).body.id;
    muffinId = (
      await auth(http().post('/products'))
        .send({ name: 'Muffin', price: 2, categoryId: cat.body.id, stock: 4 })
        .expect(201)
    ).body.id;

    const mk = async (name: string, unit: string, stockQuantity: number) =>
      (
        await auth(http().post('/inventory'))
          .send({ name, category: 'Packaging', unit, stockQuantity })
          .expect(201)
      ).body.id as number;
    cupId = await mk('Cup 16oz', 'pcs', 10);
    milkId = await mk('Fresh Milk', 'ml', 1000);
    beansId = await mk('Coffee Beans', 'g', 100);

    await auth(http().post('/recipes'))
      .send({
        productId: latteId,
        size: 'M',
        items: [
          { inventoryItemId: cupId, quantity: 1 },
          { inventoryItemId: milkId, quantity: 200 },
          { inventoryItemId: beansId, quantity: 18 },
        ],
      })
      .expect(201);
  });

  it('rejects recipes for sizes the product does not sell', async () => {
    await auth(http().post('/recipes'))
      .send({
        productId: latteId,
        size: 'XL',
        items: [{ inventoryItemId: cupId, quantity: 1 }],
      })
      .expect(400);
    await auth(http().post('/recipes'))
      .send({
        productId: muffinId,
        size: 'S',
        items: [{ inventoryItemId: cupId, quantity: 1 }],
      })
      .expect(400);
  });

  it('reports servings the ingredients cover, per recipe size', async () => {
    const p = await product(latteId);
    // cup 10, milk 1000/200 = 5, beans 100/18 = 5.5 → 5
    expect(p.recipes).toEqual([{ size: 'M', servings: 5 }]);
  });

  it('sells a recipe size from consumables even with zero drink stock', async () => {
    const res = await auth(http().post('/orders'))
      .send({
        items: [
          { productId: latteId, size: 'M', quantity: 2 },
          { productId: muffinId, quantity: 1 },
        ],
      })
      .expect(201);
    firstOrderId = res.body.id;
    const sources = Object.fromEntries(
      res.body.items.map((i: { productId: number; stockSource: string }) => [
        i.productId,
        i.stockSource,
      ]),
    );
    expect(sources[latteId]).toBe('recipe');
    expect(sources[muffinId]).toBe('stock');

    // Recipe line: consumables down, drink stock untouched.
    expect(await inventory(cupId)).toBe(8);
    expect(await inventory(milkId)).toBe(600);
    expect(await inventory(beansId)).toBe(64);
    const latte = await product(latteId);
    expect(
      latte.variants.find((v: { size: string }) => v.size === 'M').stock,
    ).toBe(0);
    expect(latte.recipes).toEqual([{ size: 'M', servings: 3 }]);
    // Stock line: the muffin count went down.
    expect((await product(muffinId)).stock).toBe(3);

    const movements = (await auth(http().get('/inventory/movements'))).body;
    const forOrder = movements.filter(
      (m: { orderId: number }) => m.orderId === firstOrderId,
    );
    expect(forOrder).toHaveLength(3);
    expect(
      forOrder.every((m: { reason: string }) => m.reason === 'order_deduction'),
    ).toBe(true);
    expect(forOrder[0].user?.name).toBe('Boss');
  });

  it('still counts a stock-counted size from its own stock', async () => {
    await auth(http().post('/orders'))
      .send({ items: [{ productId: latteId, size: 'S', quantity: 4 }] })
      .expect(400); // only 3 S in stock
  });

  it('rolls the whole order back when an ingredient runs short', async () => {
    const res = await auth(http().post('/orders'))
      .send({
        items: [
          { productId: muffinId, quantity: 1 },
          { productId: latteId, size: 'M', quantity: 4 }, // needs 800 ml, have 600
        ],
      })
      .expect(400);
    expect(res.body.message).toMatch(/Fresh Milk/);
    expect((await product(muffinId)).stock).toBe(3); // muffin line rolled back
    expect(await inventory(milkId)).toBe(600);
  });

  it('cancelling returns consumables and stock alike, once', async () => {
    await auth(http().patch(`/orders/${firstOrderId}/status`))
      .send({ status: 'cancelled' })
      .expect(200);
    expect(await inventory(cupId)).toBe(10);
    expect(await inventory(milkId)).toBe(1000);
    expect(await inventory(beansId)).toBe(100);
    expect((await product(muffinId)).stock).toBe(4);

    const movements = (await auth(http().get('/inventory/movements'))).body;
    const returned = movements.filter(
      (m: { orderId: number; reason: string }) =>
        m.orderId === firstOrderId && m.reason === 'order_refund',
    );
    expect(returned).toHaveLength(3);
    expect(returned[0].user?.name).toBe('Boss');

    // Repeating the cancel is a no-op: nothing is returned twice.
    await auth(http().patch(`/orders/${firstOrderId}/status`))
      .send({ status: 'cancelled' })
      .expect(200);
    expect(await inventory(milkId)).toBe(1000);
  });

  it('refund reverses what was deducted, not the recipe as edited later', async () => {
    const order = await auth(http().post('/orders'))
      .send({ items: [{ productId: latteId, size: 'M', quantity: 1 }] })
      .expect(201);
    expect(await inventory(milkId)).toBe(800);
    await auth(http().post('/payments'))
      .send({ orderId: order.body.id, method: 'cash', tendered: 5 })
      .expect(201);

    // Recipe now says 500 ml — the sale still only took 200.
    await auth(http().post('/recipes'))
      .send({
        productId: latteId,
        size: 'M',
        items: [
          { inventoryItemId: cupId, quantity: 1 },
          { inventoryItemId: milkId, quantity: 500 },
        ],
      })
      .expect(201);

    await auth(http().post(`/orders/${order.body.id}/refund`)).expect(201);
    expect(await inventory(milkId)).toBe(1000);
    expect(await inventory(beansId)).toBe(100);
    expect(await inventory(cupId)).toBe(10);
  });

  it('refuses to delete a consumable a recipe still uses', async () => {
    const res = await auth(http().delete(`/inventory/${milkId}`)).expect(409);
    expect(res.body.message).toMatch(/Iced Latte \(M\)/);
  });

  it('keeps the recipe when its size is renamed, drops it when removed', async () => {
    await auth(http().patch(`/products/${latteId}`))
      .send({
        sizes: [
          { size: 'S', price: 3, stock: 3 },
          { size: 'Medium', price: 3.5, stock: 0 },
        ],
      })
      .expect(200);
    let recipes = (await auth(http().get(`/recipes/product/${latteId}`))).body;
    expect(recipes.map((r: { size: string }) => r.size)).toEqual(['Medium']);

    // Sized → sizeless: the recipe becomes the product's default recipe.
    await auth(http().patch(`/products/${latteId}`))
      .send({ sizes: [] })
      .expect(200);
    recipes = (await auth(http().get(`/recipes/product/${latteId}`))).body;
    expect(recipes.map((r: { size: string | null }) => r.size)).toEqual([null]);
    expect((await product(latteId)).recipes).toEqual([
      { size: null, servings: 2 }, // milk 1000 / 500
    ]);

    // Sizeless → sized: the default recipe seeds every new size.
    await auth(http().patch(`/products/${latteId}`))
      .send({
        sizes: [
          { size: 'S', price: 3 },
          { size: 'L', price: 4 },
        ],
      })
      .expect(200);
    recipes = (await auth(http().get(`/recipes/product/${latteId}`))).body;
    expect(recipes.map((r: { size: string }) => r.size).sort()).toEqual([
      'L',
      'S',
    ]);

    // Removing a size takes its recipe with it.
    await auth(http().patch(`/products/${latteId}`))
      .send({ sizes: [{ size: 'S', price: 3 }] })
      .expect(200);
    recipes = (await auth(http().get(`/recipes/product/${latteId}`))).body;
    expect(recipes.map((r: { size: string }) => r.size)).toEqual(['S']);
  });

  it('journals the applied change on a clamped restock and on edits', async () => {
    const before = await inventory(beansId);
    const res = await auth(http().post(`/inventory/${beansId}/restock`))
      .send({ delta: -99999, reason: 'spillage' })
      .expect(201);
    expect(Number(res.body.stockQuantity)).toBe(0);
    let movements = (await auth(http().get('/inventory/movements'))).body;
    expect(Number(movements[0].delta)).toBe(-before);
    expect(Number(movements[0].stockAfter)).toBe(0);

    await auth(http().patch(`/inventory/${beansId}`))
      .send({ stockQuantity: 50 })
      .expect(200);
    movements = (await auth(http().get('/inventory/movements'))).body;
    expect(movements[0].reason).toBe('correction');
    expect(Number(movements[0].delta)).toBe(50);
    expect(movements[0].user?.name).toBe('Boss');
  });
});
