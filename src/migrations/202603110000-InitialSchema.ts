import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema202603110000 implements MigrationInterface {
  name = "InitialSchema1741769000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "threads_platform_enum" AS ENUM ('telegram', 'api')
    `);

    await queryRunner.query(`
      CREATE TABLE "threads" (
        "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
        "agent_id"   VARCHAR     NOT NULL,
        "user_id"    VARCHAR     NOT NULL,
        "platform"   "threads_platform_enum" NOT NULL DEFAULT 'telegram',
        "created_at" TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_threads_agent_user_platform" UNIQUE ("agent_id", "user_id", "platform"),
        CONSTRAINT "PK_threads" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "messages_direction_enum" AS ENUM ('incoming', 'outgoing')
    `);

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
        "thread_id"  UUID        NOT NULL,
        "content"    TEXT        NOT NULL,
        "direction"  "messages_direction_enum" NOT NULL,
        "created_at" TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "messages"
        ADD CONSTRAINT "FK_messages_thread_id"
        FOREIGN KEY ("thread_id") REFERENCES "threads"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_messages_thread_id"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TYPE "messages_direction_enum"`);
    await queryRunner.query(`DROP TABLE "threads"`);
    await queryRunner.query(`DROP TYPE "threads_platform_enum"`);
  }
}
