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
        INDEX \`IDX_b20552db2cfc7954122da9c496\` (\`orderId\`, \`reason\`),
        CONSTRAINT \`FK_f9a6cc64fcb1e9a48f60980610b\` FOREIGN KEY (\`inventoryItemId\`) REFERENCES \`inventory_items\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_7fd6b141c027be66629d76f26b7\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
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
        UNIQUE INDEX \`IDX_e855894da1c93cc2f18b50b4dc\` (\`productId\`, \`size\`),
        CONSTRAINT \`FK_67c6c6236c69cf0173a89083485\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`recipe_items\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`recipeId\` int NOT NULL,
        \`inventoryItemId\` int NOT NULL,
        \`quantity\` decimal(12,3) NOT NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_2c44770a9565be7ea9327b1a2ab\` FOREIGN KEY (\`recipeId\`) REFERENCES \`recipes\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_c8b241ae134f772a6f0bf38a96b\` FOREIGN KEY (\`inventoryItemId\`) REFERENCES \`inventory_items\`(\`id\`) ON DELETE CASCADE
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
