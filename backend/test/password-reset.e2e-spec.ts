/* eslint-disable @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument --
   supertest's res.body is `any`; asserting every response shape would bury
   the test in casts without making it safer. */
// End-to-end coverage of the admin forgot-password flow: who may use it, the
// code → token → new password handshake, and the limits that stop the OTP
// being brute-forced, replayed or used to spam the mailbox.
//
// Runs against a throwaway MySQL database (poscafe_test_auth) that is dropped and
// recreated on every run (one database per suite so parallel Jest
// workers never clobber each other); the app builds its schema there via synchronize.
process.env.DB_NAME = 'poscafe_test_auth';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_MIGRATIONS_RUN = 'false';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { MailService } from './../src/common/mail/mail.service';

jest.setTimeout(30000);

interface SentMail {
  to: string;
  subject: string;
  text: string;
}

describe('Password reset (e2e)', () => {
  let app: INestApplication;
  let http: () => request.Agent;
  // Every message the app tried to send, in order. Standing in for SMTP is the
  // only way to read the code — it never appears in an API response.
  const outbox: SentMail[] = [];

  const ADMIN = {
    username: 'owner',
    email: 'owner@example.test',
    password: 'original123',
  };
  const SECOND_ADMIN = {
    username: 'owner2',
    email: 'owner2@example.test',
    password: 'original123',
  };
  const CASHIER = { username: 'barista', password: 'original123' };

  /** Pulls the 6-digit code out of the newest message. */
  const latestCode = (): string => {
    const mail = outbox[outbox.length - 1];
    const match = /(\d{6})/.exec(mail.subject);
    if (!match) throw new Error(`No code in subject: ${mail.subject}`);
    return match[1];
  };

  beforeAll(async () => {
    // Fresh database for a deterministic run.
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? '3306'),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
    });
    await conn.query('DROP DATABASE IF EXISTS poscafe_test_auth');
    await conn.query('CREATE DATABASE poscafe_test_auth CHARACTER SET utf8mb4');
    await conn.end();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({
        isConfigured: true,
        send: (mail: SentMail) => {
          outbox.push(mail);
          return Promise.resolve();
        },
      })
      .compile();

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

    // Bootstrap admin (the first registration always becomes one), then give
    // it the recovery address the reset flow needs.
    const registered = await http()
      .post('/auth/register')
      .send({
        name: 'Owner',
        username: ADMIN.username,
        password: ADMIN.password,
      })
      .expect(201);
    const adminToken: string = registered.body.accessToken;

    await http()
      .patch(`/users/${registered.body.user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: ADMIN.email })
      .expect(200);

    // A cashier (no self-service reset) and a second admin (its own cooldown,
    // so the lockout test doesn't collide with the happy path).
    await http()
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Barista',
        username: CASHIER.username,
        password: CASHIER.password,
        role: 'cashier',
      })
      .expect(201);

    await http()
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Owner Two',
        username: SECOND_ADMIN.username,
        email: SECOND_ADMIN.email,
        password: SECOND_ADMIN.password,
        role: 'admin',
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('who can request a code', () => {
    it('answers identically for an unknown account, and sends nothing', async () => {
      const res = await http()
        .post('/auth/forgot-password')
        .send({ identifier: 'nobody-at-all' })
        .expect(200);

      expect(res.body.message).toContain('If that account');
      expect(outbox).toHaveLength(0);
    });

    it('refuses cashiers silently — an admin resets them instead', async () => {
      await http()
        .post('/auth/forgot-password')
        .send({ identifier: CASHIER.username })
        .expect(200);

      expect(outbox).toHaveLength(0);
    });

    it('mails a 6-digit code to an admin, found by username', async () => {
      await http()
        .post('/auth/forgot-password')
        .send({ identifier: ADMIN.username })
        .expect(200);

      expect(outbox).toHaveLength(1);
      expect(outbox[0].to).toBe(ADMIN.email);
      expect(latestCode()).toMatch(/^\d{6}$/);
      // The body must carry the code too, for text-only mail clients.
      expect(outbox[0].text).toContain(latestCode());
    });

    it('never returns the code in the response when mail works', async () => {
      // The dev fallback in AuthService.forgotResponse is gated on mail being
      // unconfigured; with a working sender the code must exist only in the
      // mailbox, or the endpoint hands an account over to anyone who asks.
      const res = await http()
        .post('/auth/forgot-password')
        .send({ identifier: ADMIN.username })
        .expect(200);

      expect(res.body.devCode).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain(latestCode());
    });

    it('ignores a repeat request while the last code is still fresh', async () => {
      await http()
        .post('/auth/forgot-password')
        .send({ identifier: ADMIN.username })
        .expect(200);

      expect(outbox).toHaveLength(1);
    });
  });

  describe('code → token → password', () => {
    it('rejects a wrong code', async () => {
      const wrong = latestCode() === '000000' ? '111111' : '000000';
      await http()
        .post('/auth/verify-reset-code')
        .send({ identifier: ADMIN.username, code: wrong })
        .expect(400);
    });

    it('rejects a malformed code before it reaches the service', async () => {
      await http()
        .post('/auth/verify-reset-code')
        .send({ identifier: ADMIN.username, code: 'abc123' })
        .expect(400);
    });

    let resetToken: string;

    it('exchanges the real code for a reset token', async () => {
      const res = await http()
        .post('/auth/verify-reset-code')
        .send({ identifier: ADMIN.username, code: latestCode() })
        .expect(200);

      expect(typeof res.body.resetToken).toBe('string');
      resetToken = res.body.resetToken;
    });

    it('burns the code — it cannot be verified twice', async () => {
      await http()
        .post('/auth/verify-reset-code')
        .send({ identifier: ADMIN.username, code: latestCode() })
        .expect(400);
    });

    it('refuses a login token in place of a reset token', async () => {
      const login = await http()
        .post('/auth/login')
        .send({ username: CASHIER.username, password: CASHIER.password })
        .expect(200);

      await http()
        .post('/auth/reset-password')
        .send({ resetToken: login.body.accessToken, password: 'hijacked123' })
        .expect(400);
    });

    it('sets the new password', async () => {
      await http()
        .post('/auth/reset-password')
        .send({ resetToken, password: 'brandnew123' })
        .expect(200);
    });

    it('rejects a replayed reset token', async () => {
      await http()
        .post('/auth/reset-password')
        .send({ resetToken, password: 'again12345' })
        .expect(400);
    });

    it('signs in with the new password and not the old one', async () => {
      await http()
        .post('/auth/login')
        .send({ username: ADMIN.username, password: ADMIN.password })
        .expect(401);

      await http()
        .post('/auth/login')
        .send({ username: ADMIN.username, password: 'brandnew123' })
        .expect(200);
    });

    it('also signs in with the email address', async () => {
      await http()
        .post('/auth/login')
        .send({ username: ADMIN.email, password: 'brandnew123' })
        .expect(200);
    });
  });

  describe('brute force', () => {
    it('burns the code after five wrong guesses', async () => {
      await http()
        .post('/auth/forgot-password')
        .send({ identifier: SECOND_ADMIN.email })
        .expect(200);

      const real = latestCode();
      const wrong = real === '000000' ? '111111' : '000000';

      for (let i = 0; i < 5; i++) {
        await http()
          .post('/auth/verify-reset-code')
          .send({ identifier: SECOND_ADMIN.username, code: wrong })
          .expect(400);
      }

      // Even the correct code is dead now — the attacker has to request a new
      // one, which re-arms the cooldown and mails the real owner again.
      await http()
        .post('/auth/verify-reset-code')
        .send({ identifier: SECOND_ADMIN.username, code: real })
        .expect(400);
    });
  });
});
