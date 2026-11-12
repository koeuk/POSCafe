import type { SqlDriverAdapterFactory, SqlQueryable, SqlQuery } from '@prisma/driver-adapter-utils';
import { ColumnTypeEnum } from '@prisma/driver-adapter-utils';

/**
 * Existing MySQL DATETIME values are local wall time (mysql2's default).
 * Prisma's MariaDB adapter treats them as UTC. Translate at the driver boundary
 * so existing rows, generated timestamps, raw queries, and transactions all
 * keep the same instants without rewriting historical data.
 */
function localArguments(query: SqlQuery): SqlQuery {
  return { ...query, args: query.args.map((value, index) => {
    if (value === null || query.argTypes[index]?.scalarType !== 'datetime') return value;
    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isFinite(date.getTime())) return value;
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds())).toISOString();
  }) };
}

function localResults<T extends SqlQueryable>(driver: T): T {
  return new Proxy(driver, {
    get(target, property) {
      if (property === 'queryRaw') return async (query: SqlQuery) => {
        const result = await target.queryRaw(localArguments(query));
        return { ...result, rows: result.rows.map(row => row.map((value, index) => {
          if (value === null || result.columnTypes[index] !== ColumnTypeEnum.DateTime || typeof value !== 'string') return value;
          // Remove the UTC marker that the adapter attached to local wall time.
          return new Date(value.replace(/(?:Z|[+-]\d{2}:\d{2})$/, '')).toISOString();
        })) };
      };
      if (property === 'executeRaw') return (query: SqlQuery) => target.executeRaw(localArguments(query));
      const value: unknown = Reflect.get(target, property, target);
      if (property === 'startTransaction' && typeof value === 'function') {
        return async (...args: unknown[]) => localResults(await value.apply(target, args));
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export function preserveLocalDateTime(factory: SqlDriverAdapterFactory): SqlDriverAdapterFactory {
  return { provider: factory.provider, adapterName: factory.adapterName,
    connect: async () => localResults(await factory.connect()),
  };
}
