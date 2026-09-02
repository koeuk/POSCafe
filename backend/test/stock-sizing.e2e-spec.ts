/* eslint-disable @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-return --
   supertest's res.body is `any`; asserting every response shape would bury
   the test in casts without making it safer. */
// Stock bookkeeping around the sizeless ↔ sized conversion, and the movement
// journal that has to explain every quantity change to the shop owner.
process.env.DB_NAME = 'poscafe_test';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_MIGRATIONS_RUN = 'false';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(30000);

describe('Stock sizing (e2e)', () => {
  let app: INestApplication;
  let http: () => request.Agent;
  let token: string;
  let categoryId: number;

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
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  const createSizeless = async (name: string, stock: number) => {
    const res = await auth(http().post('/products'))
      .send({ name, price: 3.5, categoryId, stock })
      .expect(201);
    return res.body.id as number;
  };

  it('clears the base stock when a sizeless product gains sizes', async () => {
    const id = await createSizeless('Latte', 50);

    await auth(http().patch(`/products/${id}`))
      .send({
        sizes: [
          { size: 'S', price: 3.0, stock: 10 },
          { size: 'L', price: 4.0, stock: 5 },
        ],
      })
      .expect(200);

    const after = await auth(http().get(`/products/${id}`)).expect(200);
    // The 50 cups lived on the base column; the sizes now own the quantities,
    // so leaving 50 there would double-count them in any products.stock sum.
    expect(after.body.stock).toBe(0);
    expect(after.body.variants).toHaveLength(2);
    expect(
      after.body.variants
        .map((v: any) => v.stock)
        .sort((a: number, b: number) => a - b),
    ).toEqual([5, 10]);
  });

  it('journals the cleared base stock instead of dropping it silently', async () => {
    const id = await createSizeless('Mocha', 40);
    await auth(http().patch(`/products/${id}`))
      .send({ sizes: [{ size: 'M', price: 3.5, stock: 7 }] })
      .expect(200);

    const moves = await auth(http().get('/products/movements?limit=50')).expect(
      200,
    );
    const mine = moves.body.filter((m: any) => m.productId === id);

    // The +40 on creation, the +7 for the new size, and the -40 correction.
    expect(mine).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ size: null, delta: 40 }),
        expect.objectContaining({ size: 'M', delta: 7 }),
        expect.objectContaining({ size: null, delta: -40, stockAfter: 0 }),
      ]),
    );
  });

  it('leaves the base stock alone for a product that stays sizeless', async () => {
    const id = await createSizeless('Drip', 25);
    await auth(http().patch(`/products/${id}`))
      .send({ name: 'Drip Coffee' })
      .expect(200);

    const after = await auth(http().get(`/products/${id}`)).expect(200);
    expect(after.body.stock).toBe(25);
  });

  it('does not journal a phantom correction when base stock is already 0', async () => {
    const id = await createSizeless('Tea', 0);
    await auth(http().patch(`/products/${id}`))
      .send({ sizes: [{ size: 'S', price: 2.0, stock: 3 }] })
      .expect(200);

    const moves = await auth(http().get('/products/movements?limit=50')).expect(
      200,
    );
    const baseMoves = moves.body.filter(
      (m: any) => m.productId === id && m.size === null,
    );
    expect(baseMoves).toHaveLength(0);
  });

  it('keeps a size’s stock when other sizes are edited around it', async () => {
    const id = await createSizeless('Flat White', 0);
    await auth(http().patch(`/products/${id}`))
      .send({
        sizes: [
          { size: 'S', price: 3.0, stock: 12 },
          { size: 'L', price: 4.0, stock: 8 },
        ],
      })
      .expect(200);

    // Re-send with S repriced and no stock field: stock must be preserved.
    await auth(http().patch(`/products/${id}`))
      .send({
        sizes: [
          { size: 'S', price: 3.25 },
          { size: 'L', price: 4.0, stock: 8 },
        ],
      })
      .expect(200);

    const after = await auth(http().get(`/products/${id}`)).expect(200);
    const s = after.body.variants.find((v: any) => v.size === 'S');
    expect(s.stock).toBe(12);
    expect(Number(s.price)).toBe(3.25);
  });

  it('discards the stock of a size that is removed', async () => {
    const id = await createSizeless('Chai', 0);
    await auth(http().patch(`/products/${id}`))
      .send({
        sizes: [
          { size: 'S', price: 3.0, stock: 4 },
          { size: 'L', price: 4.0, stock: 28 },
        ],
      })
      .expect(200);

    await auth(http().patch(`/products/${id}`))
      .send({ sizes: [{ size: 'S', price: 3.0, stock: 4 }] })
      .expect(200);

    const after = await auth(http().get(`/products/${id}`)).expect(200);
    expect(after.body.variants).toHaveLength(1);
    // 28 cups vanish with no journal entry — which is exactly why the UI now
    // confirms before letting a click do this.
    const moves = await auth(http().get('/products/movements?limit=50')).expect(
      200,
    );
    const removalMoves = moves.body.filter(
      (m: any) => m.productId === id && m.size === 'L' && m.delta < 0,
    );
    expect(removalMoves).toHaveLength(0);
  });
});
