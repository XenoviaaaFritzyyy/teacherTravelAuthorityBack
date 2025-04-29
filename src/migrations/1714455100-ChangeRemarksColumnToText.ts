import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeRemarksColumnToText1714455100 implements MigrationInterface {
    name = 'ChangeRemarksColumnToText1714455100'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "travel_request" MODIFY "remarks" TEXT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "travel_request" MODIFY "remarks" VARCHAR(255) NOT NULL DEFAULT ''`);
    }
}
