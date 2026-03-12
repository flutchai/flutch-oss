import { MigrationInterface, QueryRunner } from "typeorm";

export class DropThreadsPlatformDefault1741872000000 implements MigrationInterface {
  name = "DropThreadsPlatformDefault1741872000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "threads" ALTER COLUMN "platform" DROP DEFAULT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "threads" ALTER COLUMN "platform" SET DEFAULT 'telegram'`);
  }
}
