import { MigrationInterface, QueryRunner } from "typeorm";

export class AddViewedColumnToTravelRequest1712674523 implements MigrationInterface {
    name = 'AddViewedColumnToTravelRequest1712674523'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "travel_request" ADD "viewed" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "travel_request" DROP COLUMN "viewed"`);
    }
}
