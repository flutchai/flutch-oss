import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdminUsers202603130000 implements MigrationInterface {
  name = "AddAdminUsers1742000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_users" (
        "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
        "username"         VARCHAR(100) NOT NULL,
        "password_hash"    VARCHAR     NOT NULL,
        "password_changed" BOOLEAN     NOT NULL DEFAULT false,
        "created_by"       UUID        REFERENCES "admin_users"("id") ON DELETE SET NULL,
        "created_at"       TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_admin_users_username" UNIQUE ("username"),
        CONSTRAINT "PK_admin_users" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admin_users"`);
  }
}
