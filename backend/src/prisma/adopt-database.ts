import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

function prismaCommand(args: string[]): string {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], {
    cwd: resolve(__dirname, '../..'), env: process.env, encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Prisma CLI failed');
  return result.stdout;
}
const quote = (name: string) => '`' + name.replace(/`/g, '``') + '`';

/** Validate conversions and constraints before MySQL's non-transactional DDL. */
async function checkData(prisma: PrismaService, sql: string): Promise<void> {
  if (/\b(?:DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b/i.test(sql)) {
    throw new Error('Adoption would remove a table or column. Preserve it in the Prisma schema before adopting.');
  }
  const tables = await prisma.$queryRaw<{ name: string }[]>`
    SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`;
  const present = new Set(tables.map(t => t.name));
  const columns = await prisma.$queryRaw<{ tableName: string; name: string }[]>`
    SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`;
  const hasColumn = (table: string, field: string) => columns.some(c => c.tableName === table && c.name === field);
  const assertEmpty = async (query: string, reason: string) => {
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(query);
    if (Number(rows[0]?.count ?? 0) > 0) throw new Error(reason);
  };
  const models = Prisma.dmmf.datamodel.models;
  for (const model of models) {
    const table = model.dbName ?? model.name;
    if (!present.has(table)) continue;
    for (const field of model.fields) {
      const column = field.dbName ?? field.name;
      if (field.kind === 'object' || !hasColumn(table, column)) continue;
      const ref = `${quote(table)}.${quote(column)}`;
      if (field.type === 'Json') {
        await assertEmpty(`SELECT COUNT(*) AS count FROM ${quote(table)} WHERE ${ref} IS NOT NULL AND NOT JSON_VALID(${ref})`, `Invalid JSON in ${table}.${column}; fix these rows before adopting.`);
      }
      if (field.type === 'Boolean') {
        await assertEmpty(`SELECT COUNT(*) AS count FROM ${quote(table)} WHERE ${ref} NOT IN (0, 1)`, `Non-boolean values in ${table}.${column}.`);
      }
      if (field.kind === 'enum') {
        const values = Prisma.dmmf.datamodel.enums.find(e => e.name === field.type)!.values.map(v => "'" + (v.dbName ?? v.name).replace(/'/g, "''") + "'").join(',');
        await assertEmpty(`SELECT COUNT(*) AS count FROM ${quote(table)} WHERE ${ref} NOT IN (${values})`, `Invalid enum values in ${table}.${column}.`);
      }
    }
    const uniqueFields = [...model.uniqueFields, ...model.fields.filter(f => f.isUnique).map(f => [f.name])];
    for (const unique of uniqueFields) {
      const names = unique.map(name => model.fields.find(f => f.name === name)!.dbName ?? name);
      if (!names.every(name => hasColumn(table, name))) continue;
      const cols = names.map(quote).join(',');
      await assertEmpty(`SELECT COUNT(*) AS count FROM (SELECT ${cols} FROM ${quote(table)} WHERE ${names.map(n => `${quote(n)} IS NOT NULL`).join(' AND ')} GROUP BY ${cols} HAVING COUNT(*) > 1) duplicates`, `Duplicate values violate a unique key on ${table} (${names.join(', ')}).`);
    }
    for (const field of model.fields.filter(f => f.kind === 'object' && f.relationFromFields?.length === 1)) {
      const target = models.find(m => m.name === field.type)!;
      const from = model.fields.find(f => f.name === field.relationFromFields![0])!;
      const to = target.fields.find(f => f.name === field.relationToFields![0])!;
      const targetTable = target.dbName ?? target.name;
      const fromName = from.dbName ?? from.name;
      if (!present.has(targetTable) || !hasColumn(table, fromName)) continue;
      await assertEmpty(`SELECT COUNT(*) AS count FROM ${quote(table)} s LEFT JOIN ${quote(targetTable)} t ON s.${quote(fromName)} = t.${quote(to.dbName ?? to.name)} WHERE s.${quote(fromName)} IS NOT NULL AND t.${quote(to.dbName ?? to.name)} IS NULL`, `Orphaned references in ${table}.${fromName}.`);
    }
  }
  // Any width reduction in a divergent installation must be checked against actual data.
  for (const alter of sql.matchAll(/ALTER TABLE `([^`]+)`([\s\S]*?);/g)) {
    for (const column of alter[2].matchAll(/MODIFY `([^`]+)` VARCHAR\((\d+)\)/g)) {
      if (hasColumn(alter[1], column[1])) await assertEmpty(`SELECT COUNT(*) AS count FROM ${quote(alter[1])} WHERE CHAR_LENGTH(${quote(column[1])}) > ${Number(column[2])}`, `Values exceed the target width in ${alter[1]}.${column[1]}.`);
    }
  }
}

async function adopt(): Promise<void> {
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const sql = prismaCommand(['migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--script']);
    await checkData(prisma, sql);
    const path = resolve(process.cwd(), 'prisma/adoption-plan.sql');
    writeFileSync(path, sql, { mode: 0o600 });
    console.log(`Validated adoption plan: ${path}`);
    if (!process.argv.includes('--apply')) {
      console.log('Dry run only. Back up the database and review the SQL, then run npm run migration:adopt -- --apply.');
      return;
    }
    const historyTable = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '_prisma_migrations'`;
    let baselined = false;
    if (Number(historyTable[0].count)) {
      const history = await prisma.$queryRawUnsafe<{ migration_name: string }[]>('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
      baselined = history.some(row => row.migration_name === '0_init');
      if (history.length && !baselined) throw new Error('This database already has another Prisma migration history. Use normal migrations instead.');
    }
    const statements = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
    if (baselined && statements.length) throw new Error('Already adopted; generate a normal migration instead of changing the baseline.');
    for (const statement of statements) await prisma.$executeRawUnsafe(statement);
    if (!baselined) prismaCommand(['migrate', 'resolve', '--applied', '0_init']);
    console.log('Database adopted. Existing data and legacy migration history were retained.');
  } finally { await prisma.$disconnect(); }
}

if (require.main === module) {
  adopt().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Database adoption failed'); process.exitCode = 1; });
}
