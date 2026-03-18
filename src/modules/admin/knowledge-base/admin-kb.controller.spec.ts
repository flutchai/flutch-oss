import { Test, TestingModule } from "@nestjs/testing";
import { AdminKbController } from "./admin-kb.controller";
import { AdminKbService } from "./admin-kb.service";
import { AdminAuthGuard } from "../auth/admin-auth.guard";

const mockPaginatedKbs = { data: [], total: 0, page: 1, limit: 20 };
const mockKb = { id: "kb-1", name: "Test KB", articleCount: 0 };
const mockPaginatedArticles = { data: [], total: 0, page: 1, limit: 20 };
const mockArticle = { id: "art-1", knowledgeBaseId: "kb-1", isPublished: false };

describe("AdminKbController", () => {
  let controller: AdminKbController;
  let service: {
    listKbs: jest.Mock;
    getKb: jest.Mock;
    createKb: jest.Mock;
    updateKb: jest.Mock;
    deleteKb: jest.Mock;
    listArticles: jest.Mock;
    getArticle: jest.Mock;
    createArticle: jest.Mock;
    updateArticle: jest.Mock;
    deleteArticle: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      listKbs: jest.fn().mockResolvedValue(mockPaginatedKbs),
      getKb: jest.fn().mockResolvedValue(mockKb),
      createKb: jest.fn().mockResolvedValue(mockKb),
      updateKb: jest.fn().mockResolvedValue(mockKb),
      deleteKb: jest.fn().mockResolvedValue(undefined),
      listArticles: jest.fn().mockResolvedValue(mockPaginatedArticles),
      getArticle: jest.fn().mockResolvedValue(mockArticle),
      createArticle: jest.fn().mockResolvedValue(mockArticle),
      updateArticle: jest.fn().mockResolvedValue(mockArticle),
      deleteArticle: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminKbController],
      providers: [{ provide: AdminKbService, useValue: service }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminKbController>(AdminKbController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Knowledge Base endpoints ──────────────────────────────────────────────

  describe("GET /", () => {
    it("delegates list() to service with page and limit", async () => {
      const result = await controller.list("2", "10");

      expect(service.listKbs).toHaveBeenCalledWith("2", "10");
      expect(result).toBe(mockPaginatedKbs);
    });

    it("uses default page=1, limit=20 when not provided", async () => {
      const result = await controller.list();

      expect(service.listKbs).toHaveBeenCalledWith("1", "20");
      expect(result).toBe(mockPaginatedKbs);
    });
  });

  describe("GET /:id", () => {
    it("delegates getKb(id) to service", async () => {
      const result = await controller.getKb("kb-1");

      expect(service.getKb).toHaveBeenCalledWith("kb-1");
      expect(result).toBe(mockKb);
    });
  });

  describe("POST /", () => {
    it("delegates createKb(body) to service", async () => {
      const body = { name: "New KB", description: "desc" };
      const result = await controller.createKb(body as any);

      expect(service.createKb).toHaveBeenCalledWith(body);
      expect(result).toBe(mockKb);
    });
  });

  describe("PATCH /:id", () => {
    it("delegates updateKb(id, body) to service", async () => {
      const body = { name: "Updated KB" };
      const result = await controller.updateKb("kb-1", body as any);

      expect(service.updateKb).toHaveBeenCalledWith("kb-1", body);
      expect(result).toBe(mockKb);
    });
  });

  describe("DELETE /:id", () => {
    it("delegates deleteKb(id) to service and returns 204 (undefined)", async () => {
      const result = await controller.deleteKb("kb-1");

      expect(service.deleteKb).toHaveBeenCalledWith("kb-1");
      expect(result).toBeUndefined();
    });
  });

  // ─── Article endpoints ────────────────────────────────────────────────────

  describe("GET /:kbId/articles", () => {
    it("delegates listArticles(kbId, page, limit) to service", async () => {
      const result = await controller.listArticles("kb-1", "1", "20");

      expect(service.listArticles).toHaveBeenCalledWith("kb-1", "1", "20");
      expect(result).toBe(mockPaginatedArticles);
    });
  });

  describe("GET /:kbId/articles/:id", () => {
    it("delegates getArticle(kbId, id) to service", async () => {
      const result = await controller.getArticle("kb-1", "art-1");

      expect(service.getArticle).toHaveBeenCalledWith("kb-1", "art-1");
      expect(result).toBe(mockArticle);
    });
  });

  describe("POST /:kbId/articles", () => {
    it("delegates createArticle(kbId, body) to service", async () => {
      const body = { title: "Article 1", content: "Content" };
      const result = await controller.createArticle("kb-1", body as any);

      expect(service.createArticle).toHaveBeenCalledWith("kb-1", body);
      expect(result).toBe(mockArticle);
    });
  });

  describe("PATCH /:kbId/articles/:id", () => {
    it("delegates updateArticle(kbId, id, body) to service", async () => {
      const body = { isPublished: true };
      const result = await controller.updateArticle("kb-1", "art-1", body as any);

      expect(service.updateArticle).toHaveBeenCalledWith("kb-1", "art-1", body);
      expect(result).toBe(mockArticle);
    });
  });

  describe("DELETE /:kbId/articles/:id", () => {
    it("delegates deleteArticle(kbId, id) to service and returns 204 (undefined)", async () => {
      const result = await controller.deleteArticle("kb-1", "art-1");

      expect(service.deleteArticle).toHaveBeenCalledWith("kb-1", "art-1");
      expect(result).toBeUndefined();
    });
  });
});
