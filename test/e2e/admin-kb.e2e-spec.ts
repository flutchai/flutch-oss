/**
 * E2E test for Admin Knowledge Base API — runs against a real PostgreSQL database.
 *
 * External services are mocked (SearchService — no real OpenAI calls).
 * Schema is managed via MIGRATIONS to ensure dev/test/prod parity.
 *
 * Requirements:
 *   - Postgres running and accessible via env vars (see .env.example)
 *   - In CI: provided by GitHub Actions `services.postgres`
 *   - Locally: `docker-compose up postgres -d && POSTGRES_DB=flutch_oss_test yarn test:e2e`
 */
import * as bcrypt from "bcrypt";
import { DataSource, Repository } from "typeorm";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { SearchService } from "@flutchai/knowledge";

import { Thread } from "../../src/modules/database/entities/thread.entity";
import { Message } from "../../src/modules/database/entities/message.entity";
import { User } from "../../src/modules/database/entities/user.entity";
import { UserIdentity } from "../../src/modules/database/entities/user-identity.entity";
import { AdminUser } from "../../src/modules/database/entities/admin-user.entity";
import { KnowledgeBase } from "../../src/modules/kms/entities/knowledge-base.entity";
import { Article } from "../../src/modules/kms/entities/article.entity";

import { AdminAuthController } from "../../src/modules/admin/auth/admin-auth.controller";
import { AdminAuthService } from "../../src/modules/admin/auth/admin-auth.service";
import { AdminAuthGuard } from "../../src/modules/admin/auth/admin-auth.guard";
import { AdminKbController } from "../../src/modules/admin/knowledge-base/admin-kb.controller";
import { AdminKbService } from "../../src/modules/admin/knowledge-base/admin-kb.service";

describe("Admin Knowledge Base (E2E)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminUserRepo: Repository<AdminUser>;
  let mockSearchService: { indexArticle: jest.Mock; removeArticleFromIndex: jest.Mock };
  let accessToken: string;
  let kbId: string;
  let articleId: string;

  beforeAll(async () => {
    mockSearchService = {
      indexArticle: jest.fn().mockResolvedValue(undefined),
      removeArticleFromIndex: jest.fn().mockResolvedValue(undefined),
    };

    const jwtSecret = "test-jwt-secret-for-e2e";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              ADMIN_JWT_SECRET: jwtSecret,
              ADMIN_PASSWORD: "admin-e2e-password",
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: "postgres",
          host: process.env.POSTGRES_HOST ?? "localhost",
          port: parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
          username: process.env.POSTGRES_USER ?? "flutch",
          password: process.env.POSTGRES_PASSWORD ?? "flutch",
          database: process.env.POSTGRES_DB ?? "flutch_oss_test",
          entities: [AdminUser, Thread, Message, User, UserIdentity, KnowledgeBase, Article],
          migrations: ["src/migrations/*.ts"],
          migrationsRun: true,
          synchronize: false,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([AdminUser, KnowledgeBase, Article]),
        JwtModule.register({
          secret: jwtSecret,
          signOptions: { expiresIn: "8h" },
        }),
      ],
      controllers: [AdminAuthController, AdminKbController],
      providers: [
        AdminAuthService,
        AdminAuthGuard,
        AdminKbService,
        { provide: SearchService, useValue: mockSearchService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    adminUserRepo = moduleFixture.get(getRepositoryToken(AdminUser));

    // Seed an admin user with a known bcrypt password
    const passwordHash = await bcrypt.hash("TestPass123!", 10);
    const adminUser = adminUserRepo.create({
      username: "testadmin",
      passwordHash,
      passwordChanged: true,
      createdBy: null,
    });
    await adminUserRepo.save(adminUser);

    // Obtain access token
    const loginRes = await request(app.getHttpServer())
      .post("/api/admin/auth/login")
      .send({ username: "testadmin", password: "TestPass123!" })
      .expect(200);

    accessToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockSearchService.indexArticle.mockClear();
    mockSearchService.removeArticleFromIndex.mockClear();
  });

  // ─── Auth guard ────────────────────────────────────────────────────────────

  it("1. GET /api/admin/knowledge-bases → 401 without auth", async () => {
    await request(app.getHttpServer())
      .get("/api/admin/knowledge-bases")
      .expect(401);
  });

  // ─── Empty list ────────────────────────────────────────────────────────────

  it("2. GET /api/admin/knowledge-bases → 200 empty list after auth", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/admin/knowledge-bases")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  // ─── Create KB ────────────────────────────────────────────────────────────

  it("3. POST /api/admin/knowledge-bases → 201 with id", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/admin/knowledge-bases")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Test KB", description: "desc" })
      .expect(201);

    expect(res.body).toHaveProperty("id");
    expect(res.body.name).toBe("Test KB");
    kbId = res.body.id;
  });

  // ─── List KBs with articleCount ───────────────────────────────────────────

  it("4. GET /api/admin/knowledge-bases → returns 1 item with articleCount: 0", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/admin/knowledge-bases")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(kbId);
    expect(res.body.data[0].articleCount).toBe(0);
  });

  // ─── Get single KB ────────────────────────────────────────────────────────

  it("5. GET /api/admin/knowledge-bases/:id → returns KB with articleCount: 0", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/admin/knowledge-bases/${kbId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(kbId);
    expect(res.body.articleCount).toBe(0);
  });

  // ─── Update KB ────────────────────────────────────────────────────────────

  it("6. PATCH /api/admin/knowledge-bases/:id → returns updated name", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/admin/knowledge-bases/${kbId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Updated KB" })
      .expect(200);

    expect(res.body.name).toBe("Updated KB");
  });

  // ─── Create Article ───────────────────────────────────────────────────────

  it("7. POST /api/admin/knowledge-bases/:kbId/articles → 201", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/knowledge-bases/${kbId}/articles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Article 1", content: "Content" })
      .expect(201);

    expect(res.body).toHaveProperty("id");
    expect(res.body.isPublished).toBe(false);
    articleId = res.body.id;
  });

  // ─── List Articles ────────────────────────────────────────────────────────

  it("8. GET /api/admin/knowledge-bases/:kbId/articles → returns 1 article, isPublished: false", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/admin/knowledge-bases/${kbId}/articles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(articleId);
    expect(res.body.data[0].isPublished).toBe(false);
  });

  // ─── Publish Article ──────────────────────────────────────────────────────

  it("9. PATCH article with isPublished: true → isPublished: true, searchService.indexArticle called", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/admin/knowledge-bases/${kbId}/articles/${articleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ isPublished: true })
      .expect(200);

    expect(res.body.isPublished).toBe(true);
    expect(mockSearchService.indexArticle).toHaveBeenCalledWith(articleId);
    expect(mockSearchService.removeArticleFromIndex).not.toHaveBeenCalled();
  });

  // ─── Article count updates ────────────────────────────────────────────────

  it("10. GET /api/admin/knowledge-bases/:id → articleCount: 1", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/admin/knowledge-bases/${kbId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.articleCount).toBe(1);
  });

  // ─── Unpublish Article ────────────────────────────────────────────────────

  it("11. PATCH article with isPublished: false → isPublished: false, searchService.removeArticleFromIndex called", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/admin/knowledge-bases/${kbId}/articles/${articleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ isPublished: false })
      .expect(200);

    expect(res.body.isPublished).toBe(false);
    expect(mockSearchService.removeArticleFromIndex).toHaveBeenCalledWith(articleId);
    expect(mockSearchService.indexArticle).not.toHaveBeenCalled();
  });

  // ─── Delete Article ───────────────────────────────────────────────────────

  it("12. DELETE /api/admin/knowledge-bases/:kbId/articles/:id → 204", async () => {
    await request(app.getHttpServer())
      .delete(`/api/admin/knowledge-bases/${kbId}/articles/${articleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);
  });

  it("13. GET /api/admin/knowledge-bases/:kbId/articles → empty list after delete", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/admin/knowledge-bases/${kbId}/articles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.total).toBe(0);
    expect(res.body.data).toEqual([]);
  });

  // ─── Delete KB ────────────────────────────────────────────────────────────

  it("14. DELETE /api/admin/knowledge-bases/:id → 204", async () => {
    await request(app.getHttpServer())
      .delete(`/api/admin/knowledge-bases/${kbId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);
  });

  it("15. GET /api/admin/knowledge-bases → empty list after KB delete", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/admin/knowledge-bases")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});
