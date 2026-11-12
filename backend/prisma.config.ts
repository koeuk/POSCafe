import { defineConfig } from 'prisma/config';
import { databaseUrl, loadDatabaseEnv } from './src/prisma/database.config';

loadDatabaseEnv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'npm run seed' },
  datasource: { url: databaseUrl() },
});
