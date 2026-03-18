import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("./client", () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
    delete: mockDelete,
  },
}));

const { kbApi } = await import("./knowledgeBase");

const mockKbList = {
  data: [
    {
      id: "kb-1",
      name: "Roofing FAQ",
      description: "FAQ about roofing",
      ownership: "personal",
      visibility: "private",
      visibilityStatus: "draft",
      contentType: "general",
      articleCount: 3,
      createdAt: "2024-01-01",
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
};

const mockKbDetail = {
  id: "kb-1",
  name: "Roofing FAQ",
  ownership: "personal",
  visibility: "private",
  visibilityStatus: "draft",
  contentType: "general",
  articleCount: 3,
  createdAt: "2024-01-01",
  slug: "roofing-faq",
  ownerId: "owner-1",
  settings: {},
};

const mockArticleList = {
  data: [
    {
      id: "art-1",
      title: "Article One",
      isPublished: false,
      source: "manual",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
};

const mockArticleDetail = {
  id: "art-1",
  knowledgeBaseId: "kb-1",
  isPublished: false,
  source: "manual",
  draftArticle: { title: "Article One", content: "Content here" },
  createdAt: "2024-01-01",
  updatedAt: "2024-01-02",
};

describe("kbApi", () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── Knowledge Bases ──────────────────────────────────────────────────────

  describe("list", () => {
    it("calls GET /knowledge-bases with page and limit params", async () => {
      mockGet.mockResolvedValue({ data: mockKbList });

      const result = await kbApi.list({ page: 1, limit: 20 });

      expect(mockGet).toHaveBeenCalledWith("/knowledge-bases", { params: { page: 1, limit: 20 } });
      expect(result).toEqual(mockKbList);
    });

    it("calls GET /knowledge-bases with no params when called without arguments", async () => {
      mockGet.mockResolvedValue({ data: mockKbList });

      await kbApi.list();

      expect(mockGet).toHaveBeenCalledWith("/knowledge-bases", { params: undefined });
    });

    it("returns the paginated response data", async () => {
      mockGet.mockResolvedValue({ data: mockKbList });

      const result = await kbApi.list({ page: 2, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("kb-1");
    });
  });

  describe("get", () => {
    it("calls GET /knowledge-bases/:id and returns detail", async () => {
      mockGet.mockResolvedValue({ data: mockKbDetail });

      const result = await kbApi.get("kb-1");

      expect(mockGet).toHaveBeenCalledWith("/knowledge-bases/kb-1");
      expect(result).toEqual(mockKbDetail);
      expect(result.id).toBe("kb-1");
    });
  });

  describe("create", () => {
    it("calls POST /knowledge-bases with the request body and returns detail", async () => {
      const body = { name: "New KB", description: "desc" };
      mockPost.mockResolvedValue({ data: mockKbDetail });

      const result = await kbApi.create(body);

      expect(mockPost).toHaveBeenCalledWith("/knowledge-bases", body);
      expect(result).toEqual(mockKbDetail);
    });
  });

  describe("update", () => {
    it("calls PATCH /knowledge-bases/:id with the request body and returns detail", async () => {
      const body = { name: "Updated KB" };
      const updated = { ...mockKbDetail, name: "Updated KB" };
      mockPatch.mockResolvedValue({ data: updated });

      const result = await kbApi.update("kb-1", body);

      expect(mockPatch).toHaveBeenCalledWith("/knowledge-bases/kb-1", body);
      expect(result.name).toBe("Updated KB");
    });
  });

  describe("delete", () => {
    it("calls DELETE /knowledge-bases/:id", async () => {
      mockDelete.mockResolvedValue({ data: undefined });

      await kbApi.delete("kb-1");

      expect(mockDelete).toHaveBeenCalledWith("/knowledge-bases/kb-1");
    });
  });

  // ─── Articles ─────────────────────────────────────────────────────────────

  describe("listArticles", () => {
    it("calls GET /knowledge-bases/:kbId/articles with page and limit", async () => {
      mockGet.mockResolvedValue({ data: mockArticleList });

      const result = await kbApi.listArticles("kb-1", { page: 1, limit: 20 });

      expect(mockGet).toHaveBeenCalledWith("/knowledge-bases/kb-1/articles", {
        params: { page: 1, limit: 20 },
      });
      expect(result).toEqual(mockArticleList);
    });

    it("calls correct nested URL using the given kbId", async () => {
      mockGet.mockResolvedValue({ data: mockArticleList });

      await kbApi.listArticles("kb-99", { page: 2, limit: 5 });

      expect(mockGet).toHaveBeenCalledWith("/knowledge-bases/kb-99/articles", expect.anything());
    });
  });

  describe("getArticle", () => {
    it("calls GET /knowledge-bases/:kbId/articles/:id and returns detail", async () => {
      mockGet.mockResolvedValue({ data: mockArticleDetail });

      const result = await kbApi.getArticle("kb-1", "art-1");

      expect(mockGet).toHaveBeenCalledWith("/knowledge-bases/kb-1/articles/art-1");
      expect(result).toEqual(mockArticleDetail);
      expect(result.id).toBe("art-1");
    });
  });

  describe("createArticle", () => {
    it("calls POST /knowledge-bases/:kbId/articles with the request body", async () => {
      const body = { title: "New Article", content: "Content here" };
      mockPost.mockResolvedValue({ data: mockArticleDetail });

      const result = await kbApi.createArticle("kb-1", body);

      expect(mockPost).toHaveBeenCalledWith("/knowledge-bases/kb-1/articles", body);
      expect(result).toEqual(mockArticleDetail);
    });
  });

  describe("updateArticle", () => {
    it("calls PATCH /knowledge-bases/:kbId/articles/:id with the request body", async () => {
      const body = { isPublished: true };
      const updated = { ...mockArticleDetail, isPublished: true };
      mockPatch.mockResolvedValue({ data: updated });

      const result = await kbApi.updateArticle("kb-1", "art-1", body);

      expect(mockPatch).toHaveBeenCalledWith("/knowledge-bases/kb-1/articles/art-1", body);
      expect(result.isPublished).toBe(true);
    });
  });

  describe("deleteArticle", () => {
    it("calls DELETE /knowledge-bases/:kbId/articles/:id", async () => {
      mockDelete.mockResolvedValue({ data: undefined });

      await kbApi.deleteArticle("kb-1", "art-1");

      expect(mockDelete).toHaveBeenCalledWith("/knowledge-bases/kb-1/articles/art-1");
    });

    it("uses the correct kbId and articleId in the URL", async () => {
      mockDelete.mockResolvedValue({ data: undefined });

      await kbApi.deleteArticle("kb-99", "art-55");

      expect(mockDelete).toHaveBeenCalledWith("/knowledge-bases/kb-99/articles/art-55");
    });
  });
});
