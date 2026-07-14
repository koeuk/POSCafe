import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Allow the Next.js frontend to call the API (REST + Socket.IO). We reflect
  // the request's own origin when it's trusted rather than using a wildcard,
  // because credentials are enabled. Trusted = an explicit CORS_ORIGIN entry,
  // or any localhost / private-LAN address (so the POS works from phones and
  // tablets on the same WiFi without hard-coding each device's IP).
  const allowList = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const isPrivateHost = (hostname: string): boolean =>
    /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
      hostname,
    );

  app.enableCors({
    credentials: true,
    origin: (origin, callback) => {
      // Same-origin / non-browser requests (curl, server-side) have no origin.
      if (!origin) return callback(null, true);
      if (allowList.includes(origin)) return callback(null, true);
      try {
        if (isPrivateHost(new URL(origin).hostname)) {
          return callback(null, true);
        }
      } catch {
        // malformed origin — fall through to reject
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
  });

  // Serve uploaded images statically at /uploads/<filename>.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Validate & strip incoming DTOs globally.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
