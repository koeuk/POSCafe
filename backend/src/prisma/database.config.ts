import { config } from 'dotenv';
import { resolve } from 'node:path';

/** Load the same files as Nest, with the working directory taking precedence. */
export function loadDatabaseEnv(): void {
  config({
    path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')],
    quiet: true,
  });
}

/** Existing DB_* settings remain supported; DATABASE_URL takes precedence. */
export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = encodeURIComponent(process.env.DB_USER ?? 'root');
  const password = encodeURIComponent(process.env.DB_PASSWORD ?? '');
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '3306';
  const database = encodeURIComponent(process.env.DB_NAME ?? 'poscafe');
  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}
