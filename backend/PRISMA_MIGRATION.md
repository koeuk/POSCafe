# Prisma database setup

The backend uses Prisma ORM 7 and MySQL. Existing `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, and `DB_NAME` settings still work. An optional
`DATABASE_URL` overrides them; URL-encode its username and password.
Node.js 22.12+ is required.

Run commands from `backend/`.

## Fresh, empty database

```bash
npm ci
npm run migration:run
npm run build
npm run start:prod
```

`migration:run` applies the versioned SQL in `prisma/migrations`. Startup connects
to the database; it does not change its schema. `DB_SYNCHRONIZE` and
`DB_MIGRATIONS_RUN` are no longer used.

## Existing database

Back up the database and stop writes while applying the reviewed adoption plan.
The upgrade is explicit because older installations can have missing columns,
different index names, and TEXT-backed JSON despite the previous entities.

```bash
npm ci
npm run migration:adopt
# Review prisma/adoption-plan.sql and take a database backup.
npm run migration:adopt -- --apply
npm run migration:status
npm run build
npm run start:prod
```

The first command is a read-only dry run. It checks JSON, enum and boolean values,
unique keys, foreign-key references, and string lengths before writing a plan.
It refuses plans that drop tables or columns. The apply command aligns the
schema, preserves existing rows and the legacy `migrations` table, then records
`0_init` as already applied. Do not run `migration:run` against an existing
unadopted database: the baseline creates tables that already exist.

The canonical schema retains wider legacy string limits. Added timestamp
columns receive the adoption time for existing rows; the original historical
values cannot be reconstructed. Existing timestamp columns retain their data.
MySQL DDL is not transactional: if applying a plan fails partway through, fix the
reported cause and rerun the dry run to generate the remaining changes before
applying again. Restore the backup if rollback is required.

A database with an existing Prisma migration history uses normal migrations;
the adoption command refuses to realign an already baselined database.

## Future schema changes

Edit `prisma/schema.prisma`, then create and review a migration against a
separate development database:

```bash
npm run migration:generate -- --name describe_change
npm run prisma:generate
npm run build
```

Apply committed migrations in deployment with `npm run migration:run`. Prisma
Client is generated during installation and before builds. Prisma CLI is a
development dependency; run migration commands before pruning dev dependencies.
`prisma.config.ts` is CLI configuration and does not affect Nest's source build.

## Dates, API values, and passwords

The adapter preserves the previous mysql2 driver's server-local MySQL DATETIME
convention for existing values and new writes, including generated timestamps
and transactions. Keep the backend and database on the same timezone they used
before the migration (this shop uses Asia/Phnom_Penh). Reports retain the same
local calendar-day boundaries. Do not switch server timezone without migrating
stored timestamps deliberately.

Prisma Decimal values serialize as strings, preserving decimal API values;
reports explicitly return numbers. JSON fields remain arrays/objects, with
nullable JSON stored as SQL NULL. Passwords are globally omitted, including
nested order and stock movement users; login explicitly requests the hash.

## Verification

```bash
npm run build
TZ=Asia/Phnom_Penh npm run test:e2e -- --runInBand
```

Tests recreate only explicitly named disposable `poscafe_test*` / `poscafe_probe*`
databases and initialize them from the Prisma baseline. They disable SMTP.
The migration suite checks historical/new dates, hidden password hashes,
concurrent first-user registration, stock reservation, payments, and refunds.
