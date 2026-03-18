import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ArticleSource } from "@flutchai/knowledge";
import { ArticleRepository } from "./article.repository";
import { Article } from "../entities/article.entity";

const makeArticle = (id = "art-1", kbId = "kb-1", isPublished = false): Article =>
  ({
    id,
    knowledgeBaseId: kbId,
    source: ArticleSource.MANUAL,
    draftArticle: { title: "Article Title", content: "Some content" },
    publishedArticle: isPublished ? { title: "Article Title", content: "Some content" } : undefined,
    isPublished,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-02"),
  }) as Article;

describe("ArticleRepository", () => {
  let repository: ArticleRepository;
  let repo: {
    findOne: jest.Mock;
    findAndCount: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ArticleRepository, { provide: getRepositoryToken(Article), useValue: repo }],
    }).compile();

    repository = module.get<ArticleRepository>(ArticleRepository);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── findById ─────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("returns entity when found", async () => {
      const article = makeArticle("art-1");
      repo.findOne.mockResolvedValue(article);

      const result = await repository.findById("art-1");

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: "art-1" } });
      expect(result).toBe(article);
    });

    it("returns null when not found", async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await repository.findById("ghost-id");

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: "ghost-id" } });
      expect(result).toBeNull();
    });
  });

  // ─── findByKnowledgeBase ──────────────────────────────────────────────────

  describe("findByKnowledgeBase", () => {
    it("calls findAndCount with correct where/skip/take/order and returns paginated result", async () => {
      const article = makeArticle("art-1", "kb-1");
      repo.findAndCount.mockResolvedValue([[article], 1]);

      const result = await repository.findByKnowledgeBase("kb-1", { page: 1, limit: 10 });

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { knowledgeBaseId: "kb-1" },
        skip: 0,
        take: 10,
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual({ items: [article], total: 1, page: 1, limit: 10 });
    });

    it("defaults to page 1 and limit 20 when options are not provided", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await repository.findByKnowledgeBase("kb-1", {});

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { knowledgeBaseId: "kb-1" },
        skip: 0,
        take: 20,
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    });

    it("calculates skip correctly for page 3 with limit 5", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await repository.findByKnowledgeBase("kb-1", { page: 3, limit: 5 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 })
      );
    });

    it("returns all items and total from the underlying repo", async () => {
      const articles = [makeArticle("art-1", "kb-1"), makeArticle("art-2", "kb-1", true)];
      repo.findAndCount.mockResolvedValue([articles, 7]);

      const result = await repository.findByKnowledgeBase("kb-1", { page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(7);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe("create", () => {
    it("calls repo.create and repo.save, then returns the saved entity", async () => {
      const data = {
        knowledgeBaseId: "kb-1",
        source: ArticleSource.MANUAL,
        draftArticle: { title: "New Article", content: "Content" },
        isPublished: false,
      };
      const entity = makeArticle("art-new", "kb-1");
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await repository.create(data);

      expect(repo.create).toHaveBeenCalledWith(data);
      expect(repo.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe("update", () => {
    it("calls repo.update then findById and returns the updated entity", async () => {
      const updated = makeArticle("art-1", "kb-1", true);
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValue(updated);

      const result = await repository.update("art-1", { isPublished: true });

      expect(repo.update).toHaveBeenCalledWith("art-1", { isPublished: true });
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: "art-1" } });
      expect(result).toBe(updated);
    });

    it("returns null when findById returns null after update", async () => {
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValue(null);

      const result = await repository.update("ghost-id", { isPublished: false });

      expect(repo.update).toHaveBeenCalledWith("ghost-id", { isPublished: false });
      expect(result).toBeNull();
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("calls repo.delete with the given id", async () => {
      repo.delete.mockResolvedValue(undefined);

      await repository.delete("art-1");

      expect(repo.delete).toHaveBeenCalledWith("art-1");
    });

    it("resolves without throwing even if the entity does not exist", async () => {
      repo.delete.mockResolvedValue({ affected: 0 });

      await expect(repository.delete("ghost-id")).resolves.toBeUndefined();
    });
  });
});
