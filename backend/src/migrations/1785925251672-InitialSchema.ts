import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1785925251672 implements MigrationInterface {
  name = 'InitialSchema1785925251672';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`username\` varchar(255) NOT NULL,
        \`password\` varchar(255) NOT NULL,
        \`email\` varchar(255) NULL,
        \`avatar\` varchar(500) NULL,
        \`role\` enum ('admin', 'cashier') NOT NULL DEFAULT 'cashier',
        \`allowedPages\` json NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_users_username\` (\`username\`),
        UNIQUE INDEX \`UQ_users_email\` (\`email\`),
        INDEX \`IDX_users_role_isActive\` (\`role\`, \`isActive\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`categories\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`description\` text NULL,
        \`image\` varchar(500) NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_categories_name\` (\`name\`),
        INDEX \`IDX_categories_isActive\` (\`isActive\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`sizes\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(50) NOT NULL,
        \`sortOrder\` int NOT NULL DEFAULT 0,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_sizes_name\` (\`name\`),
        INDEX \`IDX_sizes_sortOrder\` (\`sortOrder\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_settings\` (
        \`id\` int NOT NULL,
        \`appName\` varchar(100) NOT NULL DEFAULT 'POSCAFE',
        \`logoUrl\` text NULL,
        \`khrPerUsd\` int NOT NULL DEFAULT 4100,
        \`bakongAccountId\` varchar(64) NULL,
        \`bakongMerchantName\` varchar(25) NULL,
        \`bakongMerchantCity\` varchar(15) NULL,
        \`khqrDynamic\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`products\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`description\` text NULL,
        \`price\` decimal(10,2) NOT NULL,
        \`discountPercent\` int NOT NULL DEFAULT 0,
        \`image\` varchar(500) NULL,
        \`gallery\` json NULL,
        \`isAvailable\` tinyint NOT NULL DEFAULT 1,
        \`stockMode\` enum ('count', 'recipe') NOT NULL DEFAULT 'count',
        \`stock\` int NOT NULL DEFAULT 0,
        \`archivedAt\` datetime(6) NULL,
        \`categoryId\` int NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_products_name\` (\`name\`),
        INDEX \`IDX_products_archivedAt_isAvailable\` (\`archivedAt\`, \`isAvailable\`),
        INDEX \`IDX_products_categoryId_archivedAt_isAvailable\` (\`categoryId\`, \`archivedAt\`, \`isAvailable\`),
        CONSTRAINT \`FK_products_categoryId\` FOREIGN KEY (\`categoryId\`) REFERENCES \`categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`product_variants\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`productId\` int NOT NULL,
        \`size\` varchar(50) NOT NULL,
        \`price\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`sortOrder\` int NOT NULL DEFAULT 0,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_product_variants_productId_size\` (\`productId\`, \`size\`),
        CONSTRAINT \`FK_product_variants_productId\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`stock_movements\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`productId\` int NOT NULL,
        \`delta\` int NOT NULL,
        \`stockAfter\` int NOT NULL,
        \`userId\` int NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_stock_movements_productId_createdAt\` (\`productId\`, \`createdAt\`),
        CONSTRAINT \`FK_stock_movements_productId\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_stock_movements_userId\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`orders\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`orderNumber\` varchar(64) NOT NULL,
        \`status\` enum ('pending', 'preparing', 'ready', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
        \`paymentStatus\` enum ('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid',
        \`total\` decimal(10,2) NOT NULL,
        \`userId\` int NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_orders_orderNumber\` (\`orderNumber\`),
        INDEX \`IDX_orders_createdAt\` (\`createdAt\`),
        INDEX \`IDX_orders_paymentStatus_createdAt\` (\`paymentStatus\`, \`createdAt\`),
        INDEX \`IDX_orders_status_createdAt\` (\`status\`, \`createdAt\`),
        INDEX \`IDX_orders_userId_createdAt\` (\`userId\`, \`createdAt\`),
        CONSTRAINT \`FK_orders_userId\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`order_items\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`orderId\` int NOT NULL,
        \`productId\` int NOT NULL,
        \`quantity\` int NOT NULL,
        \`size\` varchar(50) NULL,
        \`note\` varchar(255) NULL,
        \`extras\` json NULL,
        \`stockSource\` enum ('recipe', 'stock') NOT NULL DEFAULT 'stock',
        \`unitPrice\` decimal(10,2) NOT NULL,
        \`subtotal\` decimal(10,2) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_order_items_orderId\` FOREIGN KEY (\`orderId\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_order_items_productId\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`payments\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`orderId\` int NOT NULL,
        \`method\` enum ('cash', 'qr', 'card') NOT NULL,
        \`amount\` decimal(10,2) NOT NULL,
        \`tendered\` decimal(10,2) NOT NULL,
        \`change\` decimal(10,2) NOT NULL,
        \`refundedAt\` datetime(6) NULL,
        \`refundedById\` int NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_payments_orderId\` (\`orderId\`),
        INDEX \`IDX_payments_createdAt\` (\`createdAt\`),
        INDEX \`IDX_payments_refundedAt\` (\`refundedAt\`),
        CONSTRAINT \`FK_payments_orderId\` FOREIGN KEY (\`orderId\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_payments_refundedById\` FOREIGN KEY (\`refundedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`payments\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`order_items\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`orders\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`stock_movements\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`product_variants\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`products\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`app_settings\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`sizes\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`categories\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`users\``);
  }
}
