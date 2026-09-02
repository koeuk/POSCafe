process.env.DB_NAME = 'poscafe_probe2';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_MIGRATIONS_RUN = 'false';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as mysql from 'mysql2/promise';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
jest.setTimeout(30000);
describe('probe2', () => {
  let app: INestApplication; let http: any; let token: string; let ds: DataSource;
  beforeAll(async () => {
    const c = await mysql.createConnection({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER ?? 'root', password: process.env.DB_PASSWORD ?? '' });
    await c.query('DROP DATABASE IF EXISTS poscafe_probe2'); await c.query('CREATE DATABASE poscafe_probe2 CHARACTER SET utf8mb4'); await c.end();
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init(); http = () => request(app.getHttpServer()); ds = app.get(DataSource);
    const r = await http().post('/auth/register').send({ name: 'O', username: 'owner', password: 'pass123' }); token = r.body.accessToken;
  });
  afterAll(async () => { await app.close(); });

  it('PROBE F: refund on a later day rewrites the earlier day-close', async () => {
    const cat = await http().post('/categories').set('Authorization', `Bearer ${token}`).send({ name: 'C' });
    const p = await http().post('/products').set('Authorization', `Bearer ${token}`).send({ name: 'X', price: 40, categoryId: cat.body.id, stock: 10 });
    const o = await http().post('/orders').set('Authorization', `Bearer ${token}`).send({ items: [{ productId: p.body.id, quantity: 1 }] });
    await http().post('/payments').set('Authorization', `Bearer ${token}`).send({ orderId: o.body.id, method: 'cash', tendered: 40 });

    // Backdate the payment + order to "Monday".
    await ds.query("UPDATE payments SET createdAt = '2026-08-31 10:00:00' WHERE orderId = ?", [o.body.id]);
    await ds.query("UPDATE orders SET createdAt = '2026-08-31 10:00:00' WHERE id = ?", [o.body.id]);

    const before = await http().get('/reports/day-close?date=2026-08-31').set('Authorization', `Bearer ${token}`);
    console.log('MONDAY close BEFORE refund: revenue=', before.body.totals.revenue, 'cashExpected=', before.body.totals.cashExpected);

    await http().post(`/orders/${o.body.id}/refund`).set('Authorization', `Bearer ${token}`);

    const after = await http().get('/reports/day-close?date=2026-08-31').set('Authorization', `Bearer ${token}`);
    console.log('MONDAY close AFTER  refund: revenue=', after.body.totals.revenue, 'cashExpected=', after.body.totals.cashExpected);
    const today = new Date(); const td = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const tue = await http().get(`/reports/day-close?date=${td}`).set('Authorization', `Bearer ${token}`);
    console.log('TODAY close refunds bucket:', JSON.stringify(tue.body.refunds));
  });
});
