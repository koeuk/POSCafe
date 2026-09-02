process.env.DB_NAME = 'poscafe_probe';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_MIGRATIONS_RUN = 'false';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from './../src/app.module';
jest.setTimeout(30000);
describe('probe', () => {
  let app: INestApplication; let http: any; let token: string; let cashierToken: string; let pid: number; let cid: number;
  beforeAll(async () => {
    const c = await mysql.createConnection({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER ?? 'root', password: process.env.DB_PASSWORD ?? '' });
    await c.query('DROP DATABASE IF EXISTS poscafe_probe'); await c.query('CREATE DATABASE poscafe_probe CHARACTER SET utf8mb4'); await c.end();
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init(); http = () => request(app.getHttpServer());
    const r = await http().post('/auth/register').send({ name: 'O', username: 'owner', password: 'pass123' }); token = r.body.accessToken;
    const cat = await http().post('/categories').set('Authorization', `Bearer ${token}`).send({ name: 'C' }); cid = cat.body.id;
    const p = await http().post('/products').set('Authorization', `Bearer ${token}`).send({ name: 'Latte', price: 3.5, categoryId: cid, stock: 10 }); pid = p.body.id;
    await http().post('/users').set('Authorization', `Bearer ${token}`).send({ name: 'Cash', username: 'cash', password: 'pass123', role: 'cashier', allowedPages: ['pos','orders','order-history','payments'] });
    const cl = await http().post('/auth/login').send({ username: 'cash', password: 'pass123' }); cashierToken = cl.body.accessToken;
  });
  afterAll(async () => { await app.close(); });

  it('PROBE A: can a cashier complete an unpaid order, and what happens to stock?', async () => {
    const o = await http().post('/orders').set('Authorization', `Bearer ${cashierToken}`).send({ items: [{ productId: pid, quantity: 2 }] });
    console.log('order created:', o.status, JSON.stringify(o.body.total), o.body.paymentStatus);
    const afterCreate = await http().get(`/products/${pid}`).set('Authorization', `Bearer ${token}`);
    console.log('stock after create:', afterCreate.body.stock);
    const done = await http().patch(`/orders/${o.body.id}/status`).set('Authorization', `Bearer ${cashierToken}`).send({ status: 'completed' });
    console.log('COMPLETE unpaid ->', done.status, done.body.status, done.body.paymentStatus);
    const afterDone = await http().get(`/products/${pid}`).set('Authorization', `Bearer ${token}`);
    console.log('stock after complete:', afterDone.body.stock);
    const canCancel = await http().patch(`/orders/${o.body.id}/status`).set('Authorization', `Bearer ${cashierToken}`).send({ status: 'cancelled' });
    console.log('cancel after complete ->', canCancel.status, canCancel.body.message);
    const pay = await http().post('/payments').set('Authorization', `Bearer ${cashierToken}`).send({ orderId: o.body.id, method: 'cash', tendered: 7 });
    console.log('pay a completed order ->', pay.status, pay.body.message ?? 'OK');
  });

  it('PROBE B: absurd cash tendered', async () => {
    const o = await http().post('/orders').set('Authorization', `Bearer ${cashierToken}`).send({ items: [{ productId: pid, quantity: 1 }] });
    const pay = await http().post('/payments').set('Authorization', `Bearer ${cashierToken}`).send({ orderId: o.body.id, method: 'cash', tendered: 350 });
    console.log('tendered 350 on $3.50 ->', pay.status, 'change=', pay.body.change);
  });

  it('PROBE C: cashier reach admin-only endpoints?', async () => {
    for (const [m, p] of [['get','/users'],['get','/reports/summary'],['get','/reports/day-close'],['get','/products/sold'],['get','/settings/payment']] as const) {
      const r = await (http() as any)[m](p).set('Authorization', `Bearer ${cashierToken}`);
      console.log(`cashier ${m.toUpperCase()} ${p} ->`, r.status);
    }
  });

  it('PROBE D: 100% discount order, cash paid at $0', async () => {
    const p = await http().post('/products').set('Authorization', `Bearer ${token}`).send({ name: 'Free', price: 5, categoryId: cid, stock: 5, discountPercent: 100 });
    const o = await http().post('/orders').set('Authorization', `Bearer ${cashierToken}`).send({ items: [{ productId: p.body.id, quantity: 1 }] });
    console.log('100% discount order total:', o.body.total);
    const pay = await http().post('/payments').set('Authorization', `Bearer ${cashierToken}`).send({ orderId: o.body.id, method: 'cash', tendered: 0 });
    console.log('cash pay $0 ->', pay.status, pay.body.message ?? 'OK');
  });

  it('PROBE E: duplicate line items for same product+size', async () => {
    const p = await http().post('/products').set('Authorization', `Bearer ${token}`).send({ name: 'Dup', price: 2, categoryId: cid, stock: 3 });
    const o = await http().post('/orders').set('Authorization', `Bearer ${cashierToken}`).send({ items: [{ productId: p.body.id, quantity: 2 }, { productId: p.body.id, quantity: 2 }] });
    console.log('order 2+2 from stock 3 ->', o.status, o.body.message ?? `total=${o.body.total}`);
    const after = await http().get(`/products/${p.body.id}`).set('Authorization', `Bearer ${token}`);
    console.log('stock after:', after.body.stock);
  });
});
