import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOriginalPosition1710000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "user" 
            ADD COLUMN "original_position" varchar NOT NULL DEFAULT ''
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "user" 
            DROP COLUMN "original_position"
        `);
    }
} 