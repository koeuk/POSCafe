/**
 * Ingredient deduction (e2e): the shop's own worked example. Iced Latte M is
 * made from coffee, milks, sugar, cup M, lid M, straw and ice; selling one
 * takes exactly those amounts out of Supplies, cup L is a separate item that
 * is never touched, and a cancel puts everything back.
 */
process.env.DB_NAME = 'poscafe_test_ingredients';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_MIGRATIONS_RUN = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

// Item → [group, unit, opening stock]
const SUPPLIES: Record<string, [string, string, number]> = {
  'Coffee Bean': ['Raw Materials', 'g', 1000],
  'Fresh Milk': ['Raw Materials', 'ml', 2000],
  'Condensed Milk': ['Raw Materials', 'ml', 500],
  Sugar: ['Raw Materials', 'g', 300],
  Ice: ['Raw Materials', 'g', 3000],
  'Cup M': ['Packaging', 'pcs', 500],
  'Cup L': ['Packaging', 'pcs', 300],
  'Lid M': ['Packaging', 'pcs', 450],
  'Lid L': ['Packaging', 'pcs', 280],
  Straw: ['Packaging', 'pcs', 700],
  Gloves: ['Operating Supplies', 'pcs', 200],
};

// Iced Latte M, per one drink sold.
const RECIPE_M: Record<string, number> = {
  'Coffee Bean': 18,
  'Fresh Milk': 120,
  'Condensed Milk': 20,
  Sugar: 10,
  'Cup M': 1,
  'Lid M': 1,
  Straw: 1,
  Ice: 150,
};

describe('Ingredient deduction — Iced Latte M (e2e)', () => {
  let app: INestApplication;
  let http: () => request.Agent;
  let token: string;
  let latteId: number;
  const ids: Record<string, number> = {};

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const stockOf = async (name: string) =>
    Number(
      (await auth(http().get(`/inventory/${ids[name]}`)).expect(200)).body
        .stockQuantity,
    );

  beforeAll(async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? '3306'),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
    });
    await conn.query('DROP DATABASE IF EXISTS poscafe_test_ingredients');
    await conn.query(
      'CREATE DATABASE poscafe_test_ingredients CHARACTER SET utf8mb4',
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
      .send({ name: 'Owner', username: 'owner', password: 'secret123' })
      .expect(201);
    token = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('files supplies under the three groups, cup sizes as separate items', async () => {
    for (const [name, [category, unit, stockQuantity]] of Object.entries(
      SUPPLIES,
    )) {
      const created = await auth(http().post('/inventory'))
        .send({ name, category, unit, stockQuantity })
        .expect(201);
      ids[name] = created.body.id;
    }
    const packaging = (
      await auth(http().get('/inventory?category=Packaging')).expect(200)
    ).body.map((i: { name: string }) => i.name);
    expect(packaging.sort()).toEqual([
      'Cup L',
      'Cup M',
      'Lid L',
      'Lid M',
      'Straw',
    ]);
    expect(ids['Cup M']).not.toBe(ids['Cup L']);
  });

  it('defines Iced Latte M as a made-to-order recipe', async () => {
    const cat = await auth(http().post('/categories'))
      .send({ name: 'Coffee' })
      .expect(201);
    latteId = (
      await auth(http().post('/products'))
        .send({
          name: 'Iced Latte',
          price: 3.75,
          categoryId: cat.body.id,
          stockMode: 'recipe',
          sizes: [
            { size: 'M', price: 3.75 },
            { size: 'L', price: 4.25 },
          ],
        })
        .expect(201)
    ).body.id;

    await auth(http().post('/recipes'))
      .send({
        productId: latteId,
        size: 'M',
        items: Object.entries(RECIPE_M).map(([name, quantity]) => ({
          inventoryItemId: ids[name],
          quantity,
        })),
      })
      .expect(201);

    const p = (await auth(http().get(`/products/${latteId}`))).body;
    // Tightest ingredient decides: fresh milk 2000 ml / 120 ml = 16 drinks.
    expect(p.recipes).toEqual([{ size: 'M', servings: 16, options: [] }]);
  });

  it('selling one Iced Latte M deducts exactly the recipe amounts', async () => {
    const before: Record<string, number> = {};
    for (const name of Object.keys(SUPPLIES))
      before[name] = await stockOf(name);

    await auth(http().post('/orders'))
      .send({ items: [{ productId: latteId, size: 'M', quantity: 1 }] })
      .expect(201);

    for (const [name, per] of Object.entries(RECIPE_M)) {
      expect({ [name]: await stockOf(name) }).toEqual({
        [name]: before[name] - per,
      });
    }
    // Other sizes' packaging and operating supplies are untouched.
    expect(await stockOf('Cup L')).toBe(before['Cup L']);
    expect(await stockOf('Lid L')).toBe(before['Lid L']);
    expect(await stockOf('Gloves')).toBe(before['Gloves']);
  });

  it('selling three multiplies every line, and a cancel returns it all', async () => {
    const before: Record<string, number> = {};
    for (const name of Object.keys(RECIPE_M))
      before[name] = await stockOf(name);

    const order = await auth(http().post('/orders'))
      .send({ items: [{ productId: latteId, size: 'M', quantity: 3 }] })
      .expect(201);
    for (const [name, per] of Object.entries(RECIPE_M)) {
      expect(await stockOf(name)).toBe(before[name] - per * 3);
    }

    await auth(http().patch(`/orders/${order.body.id}/status`))
      .send({ status: 'cancelled' })
      .expect(200);
    for (const name of Object.keys(RECIPE_M)) {
      expect(await stockOf(name)).toBe(before[name]);
    }
  });

  it('shows the movement journal per supply, tied to the order', async () => {
    const movements = (await auth(http().get('/inventory/movements?limit=100')))
      .body as { inventoryItemId: number; delta: string; reason: string }[];
    const cupM = movements.filter((m) => m.inventoryItemId === ids['Cup M']);
    expect(cupM.map((m) => [Number(m.delta), m.reason])).toEqual([
      [3, 'order_refund'],
      [-3, 'order_deduction'],
      [-1, 'order_deduction'],
    ]);
  });
});
