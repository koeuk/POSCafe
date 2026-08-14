import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds the Bakong/KHQR settings columns.
 *
 * The index renames on `password_resets` / `users` are drift correction, not
 * a functional change: AddPasswordReset named those indexes by hand, while the
 * entities let TypeORM derive hashed names. Aligning them here stops every
 * future `migration:generate` from re-proposing the same rename.
 */
export class BakongPaymentSettings1786732957669 implements MigrationInterface {
    name = 'BakongPaymentSettings1786732957669'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_password_resets_userId\` ON \`password_resets\``);
        await queryRunner.query(`DROP INDEX \`IDX_users_email\` ON \`users\``);
        await queryRunner.query(`ALTER TABLE \`app_settings\` ADD \`bakongAccountId\` varchar(64) NULL`);
        await queryRunner.query(`ALTER TABLE \`app_settings\` ADD \`bakongMerchantName\` varchar(25) NULL`);
        await queryRunner.query(`ALTER TABLE \`app_settings\` ADD \`bakongMerchantCity\` varchar(15) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_d95569f623f28a0bf034a55099\` ON \`password_resets\` (\`userId\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_d95569f623f28a0bf034a55099\` ON \`password_resets\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\``);
        await queryRunner.query(`ALTER TABLE \`app_settings\` DROP COLUMN \`bakongMerchantCity\``);
        await queryRunner.query(`ALTER TABLE \`app_settings\` DROP COLUMN \`bakongMerchantName\``);
        await queryRunner.query(`ALTER TABLE \`app_settings\` DROP COLUMN \`bakongAccountId\``);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_users_email\` ON \`users\` (\`email\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_password_resets_userId\` ON \`password_resets\` (\`userId\`)`);
    }

}
