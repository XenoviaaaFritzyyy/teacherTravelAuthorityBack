import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMetadataColumnToNotification1713857925 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE notification ADD COLUMN metadata TEXT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE notification DROP COLUMN metadata`);
    }
}
