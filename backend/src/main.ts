import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { ServerResponse } from 'http';
import { join } from 'path';
import { AppModule } from './app.module';
import { corsOrigin } from './common/cors';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Allow the Next.js frontend to call the API. The same policy is applied to
  // the Socket.IO gateway — see common/cors.ts.
  app.enableCors({ credentials: true, origin: corsOrigin });

  // Serve uploaded images statically at /uploads/<filename>. Uploads are
  // extension-allowlisted at write time, but files already on disk predate that
  // check — so serve everything here as a non-executable download and forbid
  // content-type sniffing. Even a stray .html can then never run as script on
  // this origin.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    setHeaders: (res: ServerResponse) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
      res.setHeader('Content-Disposition', 'inline');
    },
  });

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
