import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Forgot-password flow: issued OTP codes, stored as bcrypt hashes.
 * (users.email lives in the users CREATE TABLE in InitialSchema.)
 */
export class AddPasswordReset1786000000000 implements MigrationInterface {
  name = 'AddPasswordReset1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE IF NOT EXISTS `password_resets` (' +
        '`id` int NOT NULL AUTO_INCREMENT, ' +
        '`userId` int NOT NULL, ' +
        '`codeHash` varchar(255) NOT NULL, ' +
        '`expiresAt` datetime NOT NULL, ' +
        '`attempts` int NOT NULL DEFAULT 0, ' +
        '`consumedAt` datetime NULL, ' +
        '`completedAt` datetime NULL, ' +
        '`createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
        'INDEX `IDX_d95569f623f28a0bf034a55099` (`userId`), ' +
        'PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `password_resets`');
  }
}
