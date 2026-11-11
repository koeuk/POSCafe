import { DefaultNamingStrategy, Table } from 'typeorm';

/**
 * Produces deterministic, human-readable constraint and index names
 * (PK_*, UQ_*, FK_*, IDX_*) instead of TypeORM's default random hashes.
 */
export class StandardNamingStrategy extends DefaultNamingStrategy {
  private resolveTableName(tableOrName: Table | string): string {
    return this.getTableName(tableOrName).replace(/\./g, '_');
  }

  override primaryKeyName(
    tableOrName: Table | string,
    columnNames: string[],
  ): string {
    return `PK_${this.resolveTableName(tableOrName)}_${[...columnNames].sort().join('_')}`;
  }

  override uniqueConstraintName(
    tableOrName: Table | string,
    columnNames: string[],
  ): string {
    return `UQ_${this.resolveTableName(tableOrName)}_${[...columnNames].sort().join('_')}`;
  }

  override relationConstraintName(
    tableOrName: Table | string,
    columnNames: string[],
    where?: string,
  ): string {
    const suffix = where ? `_${where}` : '';
    return `UQ_${this.resolveTableName(tableOrName)}_${[...columnNames].sort().join('_')}${suffix}`;
  }

  override foreignKeyName(
    tableOrName: Table | string,
    columnNames: string[],
  ): string {
    return `FK_${this.resolveTableName(tableOrName)}_${[...columnNames].sort().join('_')}`;
  }

  override indexName(
    tableOrName: Table | string,
    columnNames: string[],
    where?: string,
  ): string {
    const suffix = where ? `_${where}` : '';
    return `IDX_${this.resolveTableName(tableOrName)}_${[...columnNames].sort().join('_')}${suffix}`;
  }
}
