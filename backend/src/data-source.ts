import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource for the TypeORM CLI (migration:generate / migration:run).
 * The runtime app configures its own connection in AppModule; keep the two
 * in sync when connection options change.
 */
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? '3306'),
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'poscafe',
  entities: [`${__dirname}/**/*.entity{.ts,.js}`],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
});
