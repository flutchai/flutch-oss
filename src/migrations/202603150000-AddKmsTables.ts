import { MigrationInterface, QueryRunner } from "typeorm";

export class AddKmsTables202603150000 implements MigrationInterface {
  name = "AddKmsTables1773540000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."knowledge_bases_ownership_enum"
        AS ENUM('personal', 'company')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."knowledge_bases_visibility_enum"
        AS ENUM('public', 'private', 'company')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."knowledge_bases_visibility_status_enum"
        AS ENUM('draft', 'published', 'archived', 'maintenance')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."knowledge_bases_content_type_enum"
        AS ENUM('general', 'landing_pages', 'link_in_bio', 'blog', 'documentation', 'ingredients_catalog', 'recipes')
    `);
    await queryRunner.query(`
      CREATE TABLE "knowledge_bases" (
        "id"               uuid NOT NULL DEFAULT gen_random_uuid(),
        "name"             character varying NOT NULL,
        "description"      character varying,
        "slug"             character varying,
        "owner_id"         character varying NOT NULL,
        "company_id"       character varying,
        "avatar_url"       character varying,
        "ownership"        "public"."knowledge_bases_ownership_enum" NOT NULL,
        "visibility"       "public"."knowledge_bases_visibility_enum" NOT NULL,
        "visibility_status" "public"."knowledge_bases_visibility_status_enum" NOT NULL DEFAULT 'draft',
        "content_type"     "public"."knowledge_bases_content_type_enum" NOT NULL DEFAULT 'general',
        "settings"         jsonb NOT NULL DEFAULT '{}',
        "stats"            jsonb,
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_knowledge_bases_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_knowledge_bases" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."articles_source_enum"
        AS ENUM('manual', 'file', 'email', 'import')
    `);
    await queryRunner.query(`
      CREATE TABLE "articles" (
        "id"                   uuid NOT NULL DEFAULT gen_random_uuid(),
        "knowledge_base_id"    uuid NOT NULL,
        "owner_id"             character varying,
        "source"               "public"."articles_source_enum" DEFAULT 'manual',
        "draft_article"        jsonb,
        "published_article"    jsonb,
        "is_published"         boolean NOT NULL DEFAULT false,
        "retriever_chunks_ids" jsonb,
        "extra"                jsonb,
        "created_at"           TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_articles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_articles_knowledge_base"
          FOREIGN KEY ("knowledge_base_id")
          REFERENCES "knowledge_bases"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_articles_knowledge_base_id" ON "articles" ("knowledge_base_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_articles_knowledge_base_id"`);
    await queryRunner.query(`DROP TABLE "articles"`);
    await queryRunner.query(`DROP TYPE "public"."articles_source_enum"`);
    await queryRunner.query(`DROP TABLE "knowledge_bases"`);
    await queryRunner.query(`DROP TYPE "public"."knowledge_bases_content_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."knowledge_bases_visibility_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."knowledge_bases_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "public"."knowledge_bases_ownership_enum"`);
  }
}
