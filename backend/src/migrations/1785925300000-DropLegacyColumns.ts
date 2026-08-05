import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cleans up columns left behind on databases that predate the migration
 * setup (they were removed from the entities while `synchronize` was off):
 * - products.sizes        — size options now live on product_variants
 * - products.totalStock   — high-water capacity replaced by stock_movements
 * - product_variants.totalStock — same
 * Fresh databases never have these, so each drop is guarded.
 */
export class DropLegacyColumns1785925300000 implements MigrationInterface {
  name = 'DropLegacyColumns1785925300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('products', 'sizes')) {
      await queryRunner.query('ALTER TABLE `products` DROP COLUMN `sizes`');
    }
    if (await queryRunner.hasColumn('products', 'totalStock')) {
      await queryRunner.query(
        'ALTER TABLE `products` DROP COLUMN `totalStock`',
      );
    }
    if (await queryRunner.hasColumn('product_variants', 'totalStock')) {
      await queryRunner.query(
        'ALTER TABLE `product_variants` DROP COLUMN `totalStock`',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `product_variants` ADD COLUMN `totalStock` int NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `products` ADD COLUMN `totalStock` int NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `products` ADD COLUMN `sizes` json NULL',
    );
  }
}
