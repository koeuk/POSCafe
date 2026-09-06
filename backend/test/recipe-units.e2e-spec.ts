/**
 * Recipe deduction with unit conversion (e2e): the shop's worked example.
 * Coffee is stocked in kg, the Iced Coffee recipes take it in g; each sale
 * converts the recipe amount into the stock unit before deducting, so 1 kg
 * minus 10 g is 0.99 kg. Cup M / Cup L are separate supplies and a size only
 * deducts its own. A short ingredient blocks the sale and changes nothing.
 */
process.env.DB_NAME = 'poscafe_test_recipe_units';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_MIGRATIONS_RUN = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

// Supply → [group, stock unit, opening stock]
const SUPPLIES: Record<string, [string, string, number]> = {
  Coffee: ['Raw Materials', 'kg', 1], // 1 kg = 1000 g
  'Fresh Milk': ['Raw Materials', 'L', 2], // 2 L = 2000 ml
  Sugar: ['Raw Materials', 'g', 300],
  Ice: ['Raw Materials', 'g', 3000],
  'Cup M': ['Packaging', 'pcs', 500],
  'Cup L': ['Packaging', 'pcs', 300],
  'Lid M': ['Packaging', 'pcs', 450],
  'Lid L': ['Packaging', 'pcs', 280],
  Straw: ['Packaging', 'pcs', 700],
};

// Recipe lines: supply → [quantity, unit the line is written in]
const RECIPE_M: Record<string, [number, string]> = {
  Coffee: [10, 'g'],
  'Fresh Milk': [100, 'ml'],
  Sugar: [10, 'g'],
  Ice: [150, 'g'],
  'Cup M': [1, 'pcs'],
  'Lid M': [1, 'pcs'],
  Straw: [1, 'pcs'],
};
const RECIPE_L: Record<string, [number, string]> = {
  Coffee: [15, 'g'],
  'Fresh Milk': [150, 'ml'],
  Sugar: [15, 'g'],
  Ice: [200, 'g'],
  'Cup L': [1, 'pcs'],
  'Lid L': [1, 'pcs'],
  Straw: [1, 'pcs'],
};

describe('Recipe deduction with unit conversion — Iced Coffee (e2e)', () => {
  let app: INestApplication;
  let http: () => request.Agent;
  let token: string;
  let icedCoffeeId: number;
  const ids: Record<string, number> = {};

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const stockOf = async (name: string) =>
    Number(
      (await auth(http().get(`/inventory/${ids[name]}`)).expect(200)).body
        .stockQuantity,
    );
  const snapshot = async () => {
    const out: Record<string, number> = {};
    for (const name of Object.keys(SUPPLIES)) out[name] = await stockOf(name);
    return out;
  };
  const sell = (size: string, quantity: number) =>
    auth(http().post('/orders')).send({
      items: [{ productId: icedCoffeeId, size, quantity }],
    });
  const setStock = (name: string, stockQuantity: number) =>
    auth(http().patch(`/inventory/${ids[name]}`))
      .send({ stockQuantity })
      .expect(200);

  beforeAll(async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? '3306'),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
    });
    await conn.query('DROP DATABASE IF EXISTS poscafe_test_recipe_units');
    await conn.query(
      'CREATE DATABASE poscafe_test_recipe_units CHARACTER SET utf8mb4',
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

    for (const [name, [category, unit, stockQuantity]] of Object.entries(
      SUPPLIES,
    )) {
      const created = await auth(http().post('/inventory'))
        .send({ name, category, unit, stockQuantity })
        .expect(201);
      ids[name] = created.body.id;
    }

    const cat = await auth(http().post('/categories'))
      .send({ name: 'Coffee' })
      .expect(201);
    icedCoffeeId = (
      await auth(http().post('/products'))
        .send({
          name: 'Iced Coffee',
          price: 2.5,
          categoryId: cat.body.id,
          stockMode: 'recipe',
          sizes: [
            { size: 'M', price: 2.5 },
            { size: 'L', price: 3.0 },
          ],
        })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const lines = (recipe: Record<string, [number, string]>) =>
    Object.entries(recipe).map(([name, [quantity, unit]]) => ({
      inventoryItemId: ids[name],
      quantity,
      unit,
    }));

  it('saves a recipe per size, lines in g/ml against kg/L stock', async () => {
    const m = await auth(http().post('/recipes'))
      .send({ productId: icedCoffeeId, size: 'M', items: lines(RECIPE_M) })
      .expect(201);
    const coffeeLine = m.body.items.find(
      (i: { inventoryItemId: number }) => i.inventoryItemId === ids.Coffee,
    );
    expect(Number(coffeeLine.quantity)).toBe(10);
    expect(coffeeLine.unit).toBe('g');
    // A line in the item's own unit stores no unit override.
    const sugarLine = m.body.items.find(
      (i: { inventoryItemId: number }) => i.inventoryItemId === ids.Sugar,
    );
    expect(sugarLine.unit).toBeNull();

    await auth(http().post('/recipes'))
      .send({ productId: icedCoffeeId, size: 'L', items: lines(RECIPE_L) })
      .expect(201);

    // Servings are computed in the stock unit — 2 L of milk is 2000 ml, so
    // milk covers 2000 / 100 = 20 M drinks (coffee would cover 100) and
    // 2000 / 150 = 13 L drinks; the tightest line decides.
    const p = (await auth(http().get(`/products/${icedCoffeeId}`))).body;
    expect(p.recipes).toEqual([
      { size: 'L', servings: 13, options: [] },
      { size: 'M', servings: 20, options: [] },
    ]);
  });

  it('rejects a recipe line in a unit the supply cannot be measured in', async () => {
    const res = await auth(http().post('/recipes'))
      .send({
        productId: icedCoffeeId,
        size: 'M',
        items: [{ inventoryItemId: ids['Cup M'], quantity: 1, unit: 'g' }],
      })
      .expect(400);
    expect(res.body.message).toContain('stocked in pcs');
    // The bad save left the M recipe untouched.
    const recipes = (
      await auth(http().get(`/recipes?productId=${icedCoffeeId}`)).expect(200)
    ).body as { size: string; items: unknown[] }[];
    expect(recipes.find((r) => r.size === 'M')?.items).toHaveLength(
      Object.keys(RECIPE_M).length,
    );
  });

  it('Test 1 — one Iced Coffee M takes 10 g off 1 kg of coffee → 0.99 kg', async () => {
    expect(await stockOf('Coffee')).toBe(1);
    await sell('M', 1).expect(201);
    expect(await stockOf('Coffee')).toBe(0.99); // 1000 g → 990 g
    expect(await stockOf('Fresh Milk')).toBe(1.9); // 2000 ml → 1900 ml
    await setStock('Coffee', 1);
    await setStock('Fresh Milk', 2);
  });

  it('Test 2 — five Iced Coffee M take 50 g → 0.95 kg', async () => {
    const before = await snapshot();
    await sell('M', 5).expect(201);
    expect(await stockOf('Coffee')).toBe(0.95); // 1000 g → 950 g
    expect(await stockOf('Fresh Milk')).toBe(1.5); // 2000 ml → 1500 ml
    expect(await stockOf('Cup M')).toBe(before['Cup M'] - 5);
    await setStock('Coffee', 1);
    await setStock('Fresh Milk', 2);
  });

  it('Test 3 — size M only deducts Cup M, never Cup L', async () => {
    await setStock('Cup M', 500);
    await setStock('Cup L', 300);
    await sell('M', 5).expect(201);
    expect(await stockOf('Cup M')).toBe(495);
    expect(await stockOf('Cup L')).toBe(300);
    expect(await stockOf('Lid M')).toBe(450 - 5 - 5 - 1);
    expect(await stockOf('Lid L')).toBe(280);

    // And the other way round: L only touches L packaging, at L amounts.
    const before = await snapshot();
    await sell('L', 2).expect(201);
    expect(await stockOf('Cup L')).toBe(before['Cup L'] - 2);
    expect(await stockOf('Cup M')).toBe(before['Cup M']);
    expect(await stockOf('Coffee')).toBe(round3(before.Coffee - 0.03)); // 2 × 15 g
    await setStock('Coffee', 1);
    await setStock('Fresh Milk', 2);
  });

  it('Test 4 — every line is multiplied by the quantity sold', async () => {
    const before = await snapshot();
    await sell('M', 2).expect(201);
    const after = await snapshot();
    const deducted = Object.fromEntries(
      Object.keys(SUPPLIES).map((n) => [n, round3(before[n] - after[n])]),
    );
    expect(deducted).toEqual({
      Coffee: 0.02, // 20 g
      'Fresh Milk': 0.2, // 200 ml
      Sugar: 20,
      Ice: 300,
      'Cup M': 2,
      'Lid M': 2,
      Straw: 2,
      'Cup L': 0,
      'Lid L': 0,
    });
  });

  it('Test 5 — a short ingredient blocks the sale and changes nothing', async () => {
    await setStock('Coffee', 0.005); // 5 g left, recipe needs 10 g
    const before = await snapshot();
    const res = await sell('M', 1).expect(400);
    expect(res.body.message).toContain('Insufficient stock: Coffee');
    expect(res.body.message).toContain('required 0.01 kg');
    expect(res.body.message).toContain('available 0.005 kg');
    expect(await snapshot()).toEqual(before);
    // No order was written either.
    const orders = (await auth(http().get('/orders')).expect(200)).body as {
      status: string;
    }[];
    expect(orders.every((o) => o.status !== 'failed')).toBe(true);
  });

  it('journals the sale in the stock unit and a cancel returns it', async () => {
    await setStock('Coffee', 1);
    const before = await snapshot();
    const order = await sell('M', 3).expect(201);
    const movements = (
      await auth(http().get('/inventory/movements?limit=100')).expect(200)
    ).body as {
      inventoryItemId: number;
      delta: string;
      stockAfter: string;
      reason: string;
      orderId: number | null;
    }[];
    const coffeeSale = movements.find(
      (m) => m.inventoryItemId === ids.Coffee && m.orderId === order.body.id,
    );
    expect(coffeeSale).toMatchObject({ reason: 'order_deduction' });
    expect(Number(coffeeSale!.delta)).toBe(-0.03);
    expect(Number(coffeeSale!.stockAfter)).toBe(0.97);

    await auth(http().patch(`/orders/${order.body.id}/status`))
      .send({ status: 'cancelled' })
      .expect(200);
    expect(await snapshot()).toEqual(before);
  });

  // ---- Customer's-choice add-ons (sugar, straw) picked at checkout ----

  it('marks sugar and straw as optional; they leave servings and stock alone', async () => {
    const items = lines(RECIPE_M).map((l) =>
      l.inventoryItemId === ids.Sugar || l.inventoryItemId === ids.Straw
        ? { ...l, optional: true }
        : l,
    );
    const saved = await auth(http().post('/recipes'))
      .send({ productId: icedCoffeeId, size: 'M', items })
      .expect(201);
    expect(
      saved.body.items.filter((i: { optional: boolean }) => i.optional).length,
    ).toBe(2);

    // The POS learns the add-ons from the product's availability.
    await setStock('Sugar', 15); // enough for one portion, not two
    const p = (await auth(http().get(`/products/${icedCoffeeId}`))).body;
    const m = p.recipes.find((r: { size: string }) => r.size === 'M');
    expect(m.options).toEqual(
      expect.arrayContaining([
        { inventoryItemId: ids.Sugar, name: 'Sugar', quantity: 10, unit: 'g' },
        { inventoryItemId: ids.Straw, name: 'Straw', quantity: 1, unit: 'pcs' },
      ]),
    );
    // 15 g sugar would cap a base recipe at 1 serving; as an add-on it doesn't.
    expect(m.servings).toBeGreaterThan(1);

    const before = await snapshot();
    await sell('M', 1).expect(201);
    expect(await stockOf('Sugar')).toBe(before.Sugar);
    expect(await stockOf('Straw')).toBe(before.Straw);
    expect(await stockOf('Coffee')).toBe(round3(before.Coffee - 0.01));
  });

  it('deducts the typed add-on amount × drinks and snapshots it on the line', async () => {
    await setStock('Sugar', 300);
    const before = await snapshot();
    const order = await auth(http().post('/orders'))
      .send({
        items: [
          {
            productId: icedCoffeeId,
            size: 'M',
            quantity: 2,
            extras: [
              { inventoryItemId: ids.Sugar, quantity: 20 }, // 20 g per drink
              { inventoryItemId: ids.Straw, quantity: 1 },
            ],
          },
        ],
      })
      .expect(201);
    expect(await stockOf('Sugar')).toBe(before.Sugar - 20 * 2);
    expect(await stockOf('Straw')).toBe(before.Straw - 1 * 2);
    expect(await stockOf('Coffee')).toBe(round3(before.Coffee - 0.02));
    expect(order.body.items[0].extras).toEqual([
      { inventoryItemId: ids.Sugar, name: 'Sugar', quantity: 20, unit: 'g' },
      { inventoryItemId: ids.Straw, name: 'Straw', quantity: 1, unit: 'pcs' },
    ]);

    await auth(http().patch(`/orders/${order.body.id}/status`))
      .send({ status: 'cancelled' })
      .expect(200);
    expect(await snapshot()).toEqual(before);
  });

  it('takes an add-on the recipe never listed, in that supply own unit', async () => {
    // The cashier may pick any supply at checkout, not only the recipe's
    // optional lines. Lid L is not in the M recipe; one is deducted on top,
    // measured in the supply's own unit (pcs).
    await setStock('Coffee', 1);
    const before = await snapshot();
    const order = await auth(http().post('/orders'))
      .send({
        items: [
          {
            productId: icedCoffeeId,
            size: 'M',
            quantity: 2,
            extras: [{ inventoryItemId: ids['Lid L'], quantity: 1 }],
          },
        ],
      })
      .expect(201);
    expect(await stockOf('Lid L')).toBe(before['Lid L'] - 2);
    expect(await stockOf('Lid M')).toBe(before['Lid M'] - 2); // recipe, as usual
    expect(order.body.items[0].extras).toEqual([
      {
        inventoryItemId: ids['Lid L'],
        name: 'Lid L',
        quantity: 1,
        unit: 'pcs',
      },
    ]);

    await auth(http().patch(`/orders/${order.body.id}/status`))
      .send({ status: 'cancelled' })
      .expect(200);
    expect(await snapshot()).toEqual(before);
  });

  it('refuses an add-on that is not a supply, and blocks when one runs short', async () => {
    const before = await snapshot();
    const bad = await auth(http().post('/orders'))
      .send({
        items: [
          {
            productId: icedCoffeeId,
            size: 'M',
            quantity: 1,
            extras: [{ inventoryItemId: 999999, quantity: 1 }],
          },
        ],
      })
      .expect(400);
    expect(bad.body.message).toContain('is not a supply');

    await setStock('Sugar', 15);
    const short = await auth(http().post('/orders'))
      .send({
        items: [
          {
            productId: icedCoffeeId,
            size: 'M',
            quantity: 1,
            extras: [{ inventoryItemId: ids.Sugar, quantity: 20 }],
          },
        ],
      })
      .expect(400);
    expect(short.body.message).toContain('Insufficient stock: Sugar');
    expect(short.body.message).toContain('required 20 g');
    expect(short.body.message).toContain('available 15 g');
    expect(await snapshot()).toEqual({ ...before, Sugar: 15 });
  });
});

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
