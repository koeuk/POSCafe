process.env.DB_NAME = 'poscafe_probe3';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_MIGRATIONS_RUN = 'false';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from './../src/app.module';
jest.setTimeout(30000);
describe('probe3', () => {
  let app: INestApplication; let http: any; let token: string; let cid: number;
  beforeAll(async () => {
    const c = await mysql.createConnection({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER ?? 'root', password: process.env.DB_PASSWORD ?? '' });
    await c.query('DROP DATABASE IF EXISTS poscafe_probe3'); await c.query('CREATE DATABASE poscafe_probe3 CHARACTER SET utf8mb4'); await c.end();
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init(); http = () => request(app.getHttpServer());
    const r = await http().post('/auth/register').send({ name: 'O', username: 'owner', password: 'pass123' }); token = r.body.accessToken;
    const cat = await http().post('/categories').set('Authorization', `Bearer ${token}`).send({ name: 'C' }); cid = cat.body.id;
  });
  afterAll(async () => { await app.close(); });
  const A = (r: any) => r.set('Authorization', `Bearer ${token}`);

  it('PROBE G: does PATCH with sizes:null delete all variants?', async () => {
    const p = await A(http().post('/products')).send({ name: 'Sized', price: 4, categoryId: cid, sizes: [{ size: 'S', price: 3, stock: 20 }, { size: 'L', price: 5, stock: 15 }] });
    const before = await A(http().get(`/products/${p.body.id}`));
    console.log('variants before:', before.body.variants.map((v: any) => `${v.size}:${v.stock}`).join(','));
    // Exactly what the product drawer sends when the size editor is empty:
    const res = await A(http().patch(`/products/${p.body.id}`)).send({ name: 'Sized', price: 4, stock: 0, discountPercent: 0, gallery: null, sizes: null, categoryId: cid, isAvailable: true });
    console.log('PATCH sizes:null ->', res.status);
    const after = await A(http().get(`/products/${p.body.id}`));
    console.log('variants after :', JSON.stringify(after.body.variants));
  });

  it('PROBE H: settings PATCH with null bakong fields wipes config?', async () => {
    await A(http().patch('/settings')).send({ bakongAccountId: 'shop@aclb', bakongMerchantName: 'Koeuk', bakongMerchantCity: 'Phnom Penh' });
    const before = await A(http().get('/settings/payment'));
    console.log('payment cfg before:', JSON.stringify(before.body));
    // What the settings form sends when /settings/payment failed to load:
    const res = await A(http().patch('/settings')).send({ appName: 'koeuk', logoUrl: null, khrPerUsd: 4100, bakongAccountId: null, bakongMerchantName: null, bakongMerchantCity: null, khqrDynamic: true });
    console.log('PATCH with nulls ->', res.status);
    const after = await A(http().get('/settings/payment'));
    console.log('payment cfg after :', JSON.stringify(after.body));
  });
});
