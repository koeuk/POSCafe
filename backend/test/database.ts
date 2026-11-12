import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Connection } from 'mysql2/promise';

/** Only apply schema to the explicitly named disposable suite databases. */
export async function applyTestSchema(connection: Connection): Promise<void> {
  const database = process.env.DB_NAME ?? '';
  if (!/^poscafe_(test(?:_[a-z]+)*|probe[0-9]*)$/.test(database)) {
    throw new Error(
      'Refusing to apply test schema outside a disposable database',
    );
  }
  await connection.changeUser({ database });
  const sql = readFileSync(
    resolve(__dirname, '../prisma/migrations/0_init/migration.sql'),
    'utf8',
  );
  for (const statement of sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    await connection.query(statement);
  }
}
