import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Forgot-password flow: issued OTP codes, stored as bcrypt hashes.
 * (users.email lives in the users CREATE TABLE in InitialSchema.)
 */
export class AddPasswordReset1786000000000 implements MigrationInterface {
  name = 'AddPasswordReset1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`password_resets\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`userId\` int NOT NULL,
        \`codeHash\` varchar(255) NOT NULL,
        \`attempts\` int NOT NULL DEFAULT 0,
        \`expiresAt\` datetime(6) NOT NULL,
        \`consumedAt\` datetime(6) NULL,
        \`completedAt\` datetime(6) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_password_resets_userId_createdAt\` (\`userId\`, \`createdAt\`),
        INDEX \`IDX_password_resets_createdAt\` (\`createdAt\`),
        CONSTRAINT \`FK_password_resets_userId\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`password_resets\``);
  }
}
