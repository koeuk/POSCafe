import { MigrationInterface, QueryRunner } from "typeorm";

export class KhqrDynamicSetting1786735128808 implements MigrationInterface {
    name = 'KhqrDynamicSetting1786735128808'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`app_settings\` ADD \`khqrDynamic\` tinyint NOT NULL DEFAULT 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`app_settings\` DROP COLUMN \`khqrDynamic\``);
    }

}
