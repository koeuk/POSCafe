import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1785925251672 implements MigrationInterface {
  name = 'InitialSchema1785925251672';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`product_variants\` (\`id\` int NOT NULL AUTO_INCREMENT, \`productId\` int NOT NULL, \`size\` varchar(255) NOT NULL, \`price\` decimal(10,2) NOT NULL DEFAULT '0.00', \`sortOrder\` int NOT NULL DEFAULT '0', \`stock\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_274d3685fec36698a94529192f\` (\`productId\`, \`size\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`products\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`price\` decimal(10,2) NOT NULL, \`discountPercent\` int NOT NULL DEFAULT '0', \`image\` varchar(255) NULL, \`gallery\` json NULL, \`isAvailable\` tinyint NOT NULL DEFAULT 1, \`stock\` int NOT NULL DEFAULT '0', \`categoryId\` int NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`categories\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`image\` varchar(255) NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_8b0be371d28245da6e4f4b6187\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`username\` varchar(255) NOT NULL, \`password\` varchar(255) NOT NULL, \`avatar\` varchar(255) NULL, \`role\` enum ('admin', 'cashier') NOT NULL DEFAULT 'cashier', \`allowedPages\` text NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_fe0bb3f6520ee0469504521e71\` (\`username\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`order_items\` (\`id\` int NOT NULL AUTO_INCREMENT, \`orderId\` int NOT NULL, \`productId\` int NOT NULL, \`quantity\` int NOT NULL, \`size\` varchar(255) NULL, \`note\` varchar(255) NULL, \`unitPrice\` decimal(10,2) NOT NULL, \`subtotal\` decimal(10,2) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`orders\` (\`id\` int NOT NULL AUTO_INCREMENT, \`orderNumber\` varchar(255) NOT NULL, \`status\` enum ('pending', 'preparing', 'ready', 'completed', 'cancelled') NOT NULL DEFAULT 'pending', \`paymentStatus\` enum ('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid', \`total\` decimal(10,2) NOT NULL, \`userId\` int NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_59b0c3b34ea0fa5562342f2414\` (\`orderNumber\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`payments\` (\`id\` int NOT NULL AUTO_INCREMENT, \`orderId\` int NOT NULL, \`method\` enum ('cash', 'qr', 'card') NOT NULL, \`amount\` decimal(10,2) NOT NULL, \`tendered\` decimal(10,2) NOT NULL, \`change\` decimal(10,2) NOT NULL, \`refundedAt\` datetime NULL, \`refundedById\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_af929a5f2a400fdb6913b4967e\` (\`orderId\`), UNIQUE INDEX \`REL_af929a5f2a400fdb6913b4967e\` (\`orderId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`stock_movements\` (\`id\` int NOT NULL AUTO_INCREMENT, \`productId\` int NOT NULL, \`size\` varchar(255) NULL, \`delta\` int NOT NULL, \`stockAfter\` int NOT NULL, \`userId\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_fe8f81647152d8bfb9c7c4e490\` (\`productId\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`app_settings\` (\`id\` int NOT NULL, \`appName\` varchar(255) NOT NULL DEFAULT 'POSCAFE', \`logoUrl\` text NULL, \`khrPerUsd\` int NOT NULL DEFAULT '4100', PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`sizes\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`sortOrder\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_9fc6e663546e7a6cfdc465e86d\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variants\` ADD CONSTRAINT \`FK_f515690c571a03400a9876600b5\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` ADD CONSTRAINT \`FK_ff56834e735fa78a15d0cf21926\` FOREIGN KEY (\`categoryId\`) REFERENCES \`categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`order_items\` ADD CONSTRAINT \`FK_f1d359a55923bb45b057fbdab0d\` FOREIGN KEY (\`orderId\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`order_items\` ADD CONSTRAINT \`FK_cdb99c05982d5191ac8465ac010\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`orders\` ADD CONSTRAINT \`FK_151b79a83ba240b0cb31b2302d1\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD CONSTRAINT \`FK_af929a5f2a400fdb6913b4967e1\` FOREIGN KEY (\`orderId\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` ADD CONSTRAINT \`FK_a3acb59db67e977be45e382fc56\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` ADD CONSTRAINT \`FK_4fc9f6fc2db22fc301f7c1c918b\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` DROP FOREIGN KEY \`FK_4fc9f6fc2db22fc301f7c1c918b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` DROP FOREIGN KEY \`FK_a3acb59db67e977be45e382fc56\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP FOREIGN KEY \`FK_af929a5f2a400fdb6913b4967e1\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`orders\` DROP FOREIGN KEY \`FK_151b79a83ba240b0cb31b2302d1\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`order_items\` DROP FOREIGN KEY \`FK_cdb99c05982d5191ac8465ac010\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`order_items\` DROP FOREIGN KEY \`FK_f1d359a55923bb45b057fbdab0d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` DROP FOREIGN KEY \`FK_ff56834e735fa78a15d0cf21926\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variants\` DROP FOREIGN KEY \`FK_f515690c571a03400a9876600b5\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_9fc6e663546e7a6cfdc465e86d\` ON \`sizes\``,
    );
    await queryRunner.query(`DROP TABLE \`sizes\``);
    await queryRunner.query(`DROP TABLE \`app_settings\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_fe8f81647152d8bfb9c7c4e490\` ON \`stock_movements\``,
    );
    await queryRunner.query(`DROP TABLE \`stock_movements\``);
    await queryRunner.query(
      `DROP INDEX \`REL_af929a5f2a400fdb6913b4967e\` ON \`payments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_af929a5f2a400fdb6913b4967e\` ON \`payments\``,
    );
    await queryRunner.query(`DROP TABLE \`payments\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_59b0c3b34ea0fa5562342f2414\` ON \`orders\``,
    );
    await queryRunner.query(`DROP TABLE \`orders\``);
    await queryRunner.query(`DROP TABLE \`order_items\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_fe0bb3f6520ee0469504521e71\` ON \`users\``,
    );
    await queryRunner.query(`DROP TABLE \`users\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_8b0be371d28245da6e4f4b6187\` ON \`categories\``,
    );
    await queryRunner.query(`DROP TABLE \`categories\``);
    await queryRunner.query(`DROP TABLE \`products\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_274d3685fec36698a94529192f\` ON \`product_variants\``,
    );
    await queryRunner.query(`DROP TABLE \`product_variants\``);
  }
}
