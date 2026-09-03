import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConsumableInventoryAndRecipes1787000000000
  implements MigrationInterface
{
  name = 'AddConsumableInventoryAndRecipes1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`inventory_items\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`category\` varchar(100) NOT NULL DEFAULT 'packaging',
        \`unit\` varchar(50) NOT NULL DEFAULT 'pcs',
        \`stockQuantity\` decimal(12,3) NOT NULL DEFAULT '0.000',
        \`minThreshold\` decimal(12,3) NOT NULL DEFAULT '0.000',
        \`costPerUnit\` decimal(10,4) NOT NULL DEFAULT '0.0000',
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`inventory_movements\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`inventoryItemId\` int NOT NULL,
        \`delta\` decimal(12,3) NOT NULL,
        \`stockAfter\` decimal(12,3) NOT NULL,
        \`reason\` varchar(255) NOT NULL DEFAULT 'restock',
        \`orderId\` int NULL,
        \`userId\` int NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_inv_mov_item\` FOREIGN KEY (\`inventoryItemId\`) REFERENCES \`inventory_items\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_inv_mov_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`recipes\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`productId\` int NOT NULL,
        \`size\` varchar(50) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_recipe_prod_size\` (\`productId\`, \`size\`),
        CONSTRAINT \`FK_recipe_product\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`recipe_items\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`recipeId\` int NOT NULL,
        \`inventoryItemId\` int NOT NULL,
        \`quantity\` decimal(12,3) NOT NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_recitem_recipe\` FOREIGN KEY (\`recipeId\`) REFERENCES \`recipes\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_recitem_invitem\` FOREIGN KEY (\`inventoryItemId\`) REFERENCES \`inventory_items\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`recipe_items\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`recipes\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`inventory_movements\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`inventory_items\``);
  }
}
