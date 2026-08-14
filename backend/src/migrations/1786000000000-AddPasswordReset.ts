import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the forgot-password flow:
 * - users.email        — recovery address the OTP is mailed to (nullable;
 *                        MySQL permits many NULLs under a unique index, so
 *                        accounts without one don't collide)
 * - password_resets    — issued codes, stored as bcrypt hashes
 */
export class AddPasswordReset1786000000000 implements MigrationInterface {
  name = 'AddPasswordReset1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'email'))) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `email` varchar(255) NULL',
      );
      await queryRunner.query(
        'ALTER TABLE `users` ADD UNIQUE INDEX `IDX_users_email` (`email`)',
      );
    }

    if (!(await queryRunner.hasTable('password_resets'))) {
      await queryRunner.query(
        'CREATE TABLE `password_resets` (' +
          '`id` int NOT NULL AUTO_INCREMENT, ' +
          '`userId` int NOT NULL, ' +
          '`codeHash` varchar(255) NOT NULL, ' +
          '`expiresAt` datetime NOT NULL, ' +
          '`attempts` int NOT NULL DEFAULT 0, ' +
          '`consumedAt` datetime NULL, ' +
          '`completedAt` datetime NULL, ' +
          '`createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
          'INDEX `IDX_password_resets_userId` (`userId`), ' +
          'PRIMARY KEY (`id`)) ENGINE=InnoDB',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `password_resets`');
    if (await queryRunner.hasColumn('users', 'email')) {
      await queryRunner.query(
        'ALTER TABLE `users` DROP INDEX `IDX_users_email`',
      );
      await queryRunner.query('ALTER TABLE `users` DROP COLUMN `email`');
    }
  }
}
