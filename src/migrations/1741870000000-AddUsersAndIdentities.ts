import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsersAndIdentities1741870000000 implements MigrationInterface {
  name = "AddUsersAndIdentities1741870000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add WIDGET to threads platform enum
    await queryRunner.query(`ALTER TYPE "threads_platform_enum" ADD VALUE IF NOT EXISTS 'widget'`);

    // 2. Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"         UUID      NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // 3. Create user_identities table
    await queryRunner.query(`
      CREATE TABLE "user_identities" (
        "id"          UUID      NOT NULL DEFAULT gen_random_uuid(),
        "user_id"     UUID      NOT NULL,
        "platform"    "threads_platform_enum" NOT NULL,
        "external_id" VARCHAR   NOT NULL,
        "metadata"    JSONB,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_identities_platform_external" UNIQUE ("platform", "external_id"),
        CONSTRAINT "PK_user_identities" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "user_identities"
        ADD CONSTRAINT "FK_user_identities_user_id"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // 4. Migrate threads.user_id from VARCHAR to UUID FK
    //    For each unique user_id string in threads, create a user + identity row,
    //    then update the thread to point at the new user UUID.
    await queryRunner.query(
      `ALTER TABLE "threads" DROP CONSTRAINT "UQ_threads_agent_user_platform"`
    );
    await queryRunner.query(`ALTER TABLE "threads" ADD COLUMN "user_id_new" UUID`);

    // Create a user + identity for every existing thread user_id (platform-specific string)
    await queryRunner.query(`
      DO $$
      DECLARE
        rec RECORD;
        new_user_id UUID;
      BEGIN
        FOR rec IN
          SELECT DISTINCT platform, user_id FROM threads
        LOOP
          INSERT INTO users DEFAULT VALUES RETURNING id INTO new_user_id;
          INSERT INTO user_identities (user_id, platform, external_id)
            VALUES (new_user_id, rec.platform, rec.user_id);
          UPDATE threads
            SET user_id_new = new_user_id
          WHERE platform = rec.platform AND user_id = rec.user_id;
        END LOOP;
      END;
      $$
    `);

    await queryRunner.query(`ALTER TABLE "threads" DROP COLUMN "user_id"`);
    await queryRunner.query(`ALTER TABLE "threads" RENAME COLUMN "user_id_new" TO "user_id"`);
    await queryRunner.query(`ALTER TABLE "threads" ALTER COLUMN "user_id" SET NOT NULL`);

    await queryRunner.query(`
      ALTER TABLE "threads"
        ADD CONSTRAINT "FK_threads_user_id"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "threads"
        ADD CONSTRAINT "UQ_threads_agent_user_platform"
        UNIQUE ("agent_id", "user_id", "platform")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse: restore user_id as VARCHAR
    await queryRunner.query(
      `ALTER TABLE "threads" DROP CONSTRAINT "UQ_threads_agent_user_platform"`
    );
    await queryRunner.query(`ALTER TABLE "threads" DROP CONSTRAINT "FK_threads_user_id"`);
    await queryRunner.query(`ALTER TABLE "threads" ADD COLUMN "user_id_old" VARCHAR`);

    await queryRunner.query(`
      UPDATE threads t
      SET user_id_old = ui.external_id
      FROM user_identities ui
      WHERE ui.user_id = t.user_id AND ui.platform = t.platform
    `);

    await queryRunner.query(`ALTER TABLE "threads" DROP COLUMN "user_id"`);
    await queryRunner.query(`ALTER TABLE "threads" RENAME COLUMN "user_id_old" TO "user_id"`);
    await queryRunner.query(`ALTER TABLE "threads" ALTER COLUMN "user_id" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "threads"
        ADD CONSTRAINT "UQ_threads_agent_user_platform"
        UNIQUE ("agent_id", "user_id", "platform")
    `);

    await queryRunner.query(
      `ALTER TABLE "user_identities" DROP CONSTRAINT "FK_user_identities_user_id"`
    );
    await queryRunner.query(`DROP TABLE "user_identities"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
