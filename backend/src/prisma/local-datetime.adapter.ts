import type {
  SqlDriverAdapterFactory,
  SqlQueryable,
  SqlQuery,
  SqlDriverAdapter,
  Transaction,
} from '@prisma/driver-adapter-utils';
import { ColumnTypeEnum } from '@prisma/driver-adapter-utils';

/**
 * Existing MySQL DATETIME values are local wall time (mysql2's default).
 * Prisma's MariaDB adapter treats them as UTC. Translate at the driver boundary
 * so existing rows, generated timestamps, raw queries, and transactions all
 * keep the same instants without rewriting historical data.
 */
function localArguments(query: SqlQuery): SqlQuery {
  return {
    ...query,
    args: query.args.map((value, index) => {
      if (value === null || query.argTypes[index]?.scalarType !== 'datetime')
        return value;
      if (
        !(value instanceof Date) &&
        typeof value !== 'string' &&
        typeof value !== 'number'
      )
        return value;
      const date = value instanceof Date ? value : new Date(value);
      if (!Number.isFinite(date.getTime())) return value;
      return new Date(
        Date.UTC(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          date.getHours(),
          date.getMinutes(),
          date.getSeconds(),
          date.getMilliseconds(),
        ),
      ).toISOString();
    }),
  };
}

function localQueryable(driver: SqlQueryable): SqlQueryable {
  return {
    provider: driver.provider,
    adapterName: driver.adapterName,
    async queryRaw(query) {
      const result = await driver.queryRaw(localArguments(query));
      return {
        ...result,
        rows: result.rows.map((row) =>
          row.map((value, index) => {
            if (
              value === null ||
              result.columnTypes[index] !== ColumnTypeEnum.DateTime ||
              typeof value !== 'string'
            )
              return value;
            // Remove the UTC marker attached by the adapter to local wall time.
            return new Date(
              value.replace(/(?:Z|[+-]\d{2}:\d{2})$/, ''),
            ).toISOString();
          }),
        ),
      };
    },
    executeRaw: (query) => driver.executeRaw(localArguments(query)),
  };
}

function localTransaction(tx: Transaction): Transaction {
  return {
    ...localQueryable(tx),
    options: tx.options,
    commit: () => tx.commit(),
    rollback: () => tx.rollback(),
    createSavepoint: tx.createSavepoint
      ? async (name) => {
          await tx.createSavepoint?.(name);
        }
      : undefined,
    rollbackToSavepoint: tx.rollbackToSavepoint
      ? async (name) => {
          await tx.rollbackToSavepoint?.(name);
        }
      : undefined,
    releaseSavepoint: tx.releaseSavepoint
      ? async (name) => {
          await tx.releaseSavepoint?.(name);
        }
      : undefined,
  };
}

function localAdapter(driver: SqlDriverAdapter): SqlDriverAdapter {
  return {
    ...localQueryable(driver),
    executeScript: (script) => driver.executeScript(script),
    dispose: () => driver.dispose(),
    getConnectionInfo: driver.getConnectionInfo
      ? () => driver.getConnectionInfo!()
      : undefined,
    startTransaction: async (isolation) =>
      localTransaction(await driver.startTransaction(isolation)),
  };
}

export function preserveLocalDateTime(
  factory: SqlDriverAdapterFactory,
): SqlDriverAdapterFactory {
  return {
    provider: factory.provider,
    adapterName: factory.adapterName,
    connect: async () => localAdapter(await factory.connect()),
  };
}
