import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  KnowledgeBaseOwnership,
  KnowledgeBaseStatus,
  KnowledgeBaseContentType,
  VisibilityLevel,
  ArticleSource,
  SearchService,
} from "@flutchai/knowledge";
import { AdminKbService } from "./admin-kb.service";
import { KnowledgeBase } from "../../kms/entities/knowledge-base.entity";
import { Article } from "../../kms/entities/article.entity";

const makeKb = (id = "kb-1"): KnowledgeBase =>
  ({
    id,
    name: "Test KB",
    description: "A description",
    ownership: KnowledgeBaseOwnership.PERSONAL,
    visibility: VisibilityLevel.PRIVATE,
    visibilityStatus: KnowledgeBaseStatus.DRAFT,
    contentType: KnowledgeBaseContentType.GENERAL,
    ownerId: "admin",
    settings: {},
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  }) as KnowledgeBase;

const makeArticle = (id = "art-1", kbId = "kb-1", isPublished = false): Article =>
  ({
    id,
    knowledgeBaseId: kbId,
    source: ArticleSource.MANUAL,
    draftArticle: { title: "Article Title", content: "Some content" },
    publishedArticle: isPublished ? { title: "Article Title", content: "Some content" } : undefined,
    isPublished,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  }) as Article;

describe("AdminKbService", () => {
  let service: AdminKbService;
  let kbRepo: {
    findAndCount: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let articleRepo: {
    findAndCount: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let searchService: { indexArticle: jest.Mock; removeArticleFromIndex: jest.Mock };
  let mockQb: any;

  beforeEach(async () => {
    mockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    kbRepo = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    articleRepo = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };

    searchService = {
      indexArticle: jest.fn().mockResolvedValue(undefined),
      removeArticleFromIndex: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminKbService,
        { provide: getRepositoryToken(KnowledgeBase), useValue: kbRepo },
        { provide: getRepositoryToken(Article), useValue: articleRepo },
        { provide: SearchService, useValue: searchService },
      ],
    }).compile();

    service = module.get<AdminKbService>(AdminKbService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── listKbs ──────────────────────────────────────────────────────────────

  describe("listKbs", () => {
    it("returns paginated KBs with articleCount per KB", async () => {
      const kb = makeKb("kb-1");
      kbRepo.findAndCount.mockResolvedValue([[kb], 1]);
      mockQb.getRawMany.mockResolvedValue([{ kbId: "kb-1", count: "3" }]);

      const result = await service.listKbs("1", "20");

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: "kb-1",
        name: "Test KB",
        articleCount: 3,
      });
    });

    it("returns articleCount: 0 for KBs with no articles", async () => {
      const kb = makeKb("kb-2");
      kbRepo.findAndCount.mockResolvedValue([[kb], 1]);
      mockQb.getRawMany.mockResolvedValue([]);

      const result = await service.listKbs();

      expect(result.data[0].articleCount).toBe(0);
    });

    it("does not call createQueryBuilder when items list is empty", async () => {
      kbRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.listKbs();

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(articleRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("caps limit at 100", async () => {
      kbRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.listKbs("1", "999");

      expect(kbRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });

    it("respects page offset", async () => {
      kbRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.listKbs("3", "10");

      expect(kbRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 })
      );
    });
  });

  // ─── getKb ────────────────────────────────────────────────────────────────

  describe("getKb", () => {
    it("returns KB with articleCount", async () => {
      kbRepo.findOne.mockResolvedValue(makeKb("kb-1"));
      articleRepo.count.mockResolvedValue(5);

      const result = await service.getKb("kb-1");

      expect(result.id).toBe("kb-1");
      expect(result.articleCount).toBe(5);
      expect(articleRepo.count).toHaveBeenCalledWith({ where: { knowledgeBaseId: "kb-1" } });
    });

    it("throws NotFoundException when KB does not exist", async () => {
      kbRepo.findOne.mockResolvedValue(null);

      await expect(service.getKb("ghost-id")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createKb ─────────────────────────────────────────────────────────────

  describe("createKb", () => {
    it("creates entity with default ownership, visibility, and status", async () => {
      const entity = makeKb("kb-new");
      kbRepo.create.mockReturnValue(entity);
      kbRepo.save.mockResolvedValue(entity);

      const result = await service.createKb({ name: "New KB" });

      expect(kbRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New KB",
          ownership: KnowledgeBaseOwnership.PERSONAL,
          visibility: VisibilityLevel.PRIVATE,
          visibilityStatus: KnowledgeBaseStatus.DRAFT,
          contentType: KnowledgeBaseContentType.GENERAL,
          ownerId: "admin",
          settings: {},
        })
      );
      expect(kbRepo.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
    });

    it("uses provided ownership, visibility, and contentType when supplied", async () => {
      const entity = makeKb("kb-custom");
      kbRepo.create.mockReturnValue(entity);
      kbRepo.save.mockResolvedValue(entity);

      await service.createKb({
        name: "Custom KB",
        ownership: KnowledgeBaseOwnership.COMPANY,
        visibility: VisibilityLevel.PUBLIC,
        contentType: KnowledgeBaseContentType.DOCUMENTATION,
      });

      expect(kbRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownership: KnowledgeBaseOwnership.COMPANY,
          visibility: VisibilityLevel.PUBLIC,
          contentType: KnowledgeBaseContentType.DOCUMENTATION,
        })
      );
    });
  });

  // ─── updateKb ─────────────────────────────────────────────────────────────

  describe("updateKb", () => {
    it("updates KB and returns the updated record", async () => {
      const existing = makeKb("kb-1");
      const updated = { ...existing, name: "Updated Name" } as KnowledgeBase;
      kbRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
      kbRepo.update.mockResolvedValue(undefined);

      const result = await service.updateKb("kb-1", { name: "Updated Name" });

      expect(kbRepo.update).toHaveBeenCalledWith("kb-1", { name: "Updated Name" });
      expect(result).toBe(updated);
    });

    it("throws NotFoundException when KB does not exist", async () => {
      kbRepo.findOne.mockResolvedValue(null);

      await expect(service.updateKb("ghost-id", { name: "X" })).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException on empty body", async () => {
      kbRepo.findOne.mockResolvedValue(makeKb("kb-1"));

      await expect(service.updateKb("kb-1", {})).rejects.toThrow(BadRequestException);
      expect(kbRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── deleteKb ─────────────────────────────────────────────────────────────

  describe("deleteKb", () => {
    it("deletes KB when it exists and has no published articles", async () => {
      kbRepo.findOne.mockResolvedValue(makeKb("kb-1"));
      articleRepo.find.mockResolvedValue([]);
      kbRepo.delete.mockResolvedValue({ affected: 1 });

      await service.deleteKb("kb-1");

      expect(kbRepo.delete).toHaveBeenCalledWith("kb-1");
      expect(searchService.removeArticleFromIndex).not.toHaveBeenCalled();
    });

    it("removes published articles from index before deleting KB", async () => {
      kbRepo.findOne.mockResolvedValue(makeKb("kb-1"));
      articleRepo.find.mockResolvedValue([
        makeArticle("art-1", "kb-1", true),
        makeArticle("art-2", "kb-1", true),
      ]);
      kbRepo.delete.mockResolvedValue({ affected: 1 });

      await service.deleteKb("kb-1");

      expect(searchService.removeArticleFromIndex).toHaveBeenCalledWith("art-1");
      expect(searchService.removeArticleFromIndex).toHaveBeenCalledWith("art-2");
      expect(kbRepo.delete).toHaveBeenCalledWith("kb-1");
    });

    it("deletes KB even if removeArticleFromIndex throws", async () => {
      kbRepo.findOne.mockResolvedValue(makeKb("kb-1"));
      articleRepo.find.mockResolvedValue([makeArticle("art-1", "kb-1", true)]);
      searchService.removeArticleFromIndex.mockRejectedValue(new Error("index error"));
      kbRepo.delete.mockResolvedValue({ affected: 1 });

      await service.deleteKb("kb-1");

      expect(kbRepo.delete).toHaveBeenCalledWith("kb-1");
    });

    it("throws NotFoundException when KB does not exist", async () => {
      kbRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteKb("ghost-id")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── listArticles ─────────────────────────────────────────────────────────

  describe("listArticles", () => {
    it("returns paginated articles for an existing KB", async () => {
      kbRepo.findOne.mockResolvedValue(makeKb("kb-1"));
      const article = makeArticle("art-1", "kb-1");
      articleRepo.findAndCount.mockResolvedValue([[article], 1]);

      const result = await service.listArticles("kb-1");

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: "art-1",
        title: "Article Title",
        isPublished: false,
      });
    });

    it("throws NotFoundException when KB does not exist", async () => {
      kbRepo.findOne.mockResolvedValue(null);

      await expect(service.listArticles("ghost-kb")).rejects.toThrow(NotFoundException);
    });

    it("uses publishedArticle title as fallback when draftArticle is undefined", async () => {
      kbRepo.findOne.mockResolvedValue(makeKb("kb-1"));
      const article = {
        ...makeArticle("art-1", "kb-1", true),
        draftArticle: undefined,
        publishedArticle: { title: "Published Title", content: "content" },
      } as Article;
      articleRepo.findAndCount.mockResolvedValue([[article], 1]);

      const result = await service.listArticles("kb-1");

      expect(result.data[0].title).toBe("Published Title");
    });

    it("falls back to (untitled) when both draft and published titles are missing", async () => {
      kbRepo.findOne.mockResolvedValue(makeKb("kb-1"));
      const article = {
        ...makeArticle("art-1", "kb-1"),
        draftArticle: undefined,
        publishedArticle: undefined,
      } as Article;
      articleRepo.findAndCount.mockResolvedValue([[article], 1]);

      const result = await service.listArticles("kb-1");

      expect(result.data[0].title).toBe("(untitled)");
    });
  });

  // ─── getArticle ───────────────────────────────────────────────────────────

  describe("getArticle", () => {
    it("returns article when found", async () => {
      const article = makeArticle("art-1", "kb-1");
      articleRepo.findOne.mockResolvedValue(article);

      const result = await service.getArticle("kb-1", "art-1");

      expect(result).toBe(article);
      expect(articleRepo.findOne).toHaveBeenCalledWith({
        where: { id: "art-1", knowledgeBaseId: "kb-1" },
      });
    });

    it("throws NotFoundException when article does not exist", async () => {
      articleRepo.findOne.mockResolvedValue(null);

      await expect(service.getArticle("kb-1", "ghost-art")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createArticle ────────────────────────────────────────────────────────

  describe("createArticle", () => {
    it("creates article with draftArticle JSONB and isPublished: false", async () => {
      kbRepo.findOne.mockResolvedValue(makeKb("kb-1"));
      const entity = makeArticle("art-new", "kb-1");
      articleRepo.create.mockReturnValue(entity);
      articleRepo.save.mockResolvedValue(entity);

      const result = await service.createArticle("kb-1", {
        title: "Article Title",
        content: "Some content",
      });

      expect(articleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          knowledgeBaseId: "kb-1",
          source: ArticleSource.MANUAL,
          draftArticle: { title: "Article Title", content: "Some content" },
          isPublished: false,
        })
      );
      expect(articleRepo.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
    });

    it("throws NotFoundException when KB does not exist", async () => {
      kbRepo.findOne.mockResolvedValue(null);

      await expect(service.createArticle("ghost-kb", { title: "T" })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ─── updateArticle ────────────────────────────────────────────────────────

  describe("updateArticle", () => {
    it("updates draftArticle content and does NOT call searchService", async () => {
      const article = makeArticle("art-1", "kb-1", false);
      articleRepo.findOne.mockResolvedValueOnce(article).mockResolvedValueOnce({
        ...article,
        draftArticle: { title: "New Title", content: "Some content" },
      });
      articleRepo.update.mockResolvedValue(undefined);

      await service.updateArticle("kb-1", "art-1", { title: "New Title" });

      expect(articleRepo.update).toHaveBeenCalledWith(
        "art-1",
        expect.objectContaining({
          draftArticle: expect.objectContaining({ title: "New Title" }),
        })
      );
      expect(searchService.indexArticle).not.toHaveBeenCalled();
      expect(searchService.removeArticleFromIndex).not.toHaveBeenCalled();
    });

    it("publishes article: copies draft to published and calls searchService.indexArticle", async () => {
      const article = makeArticle("art-1", "kb-1", false);
      articleRepo.findOne
        .mockResolvedValueOnce(article)
        .mockResolvedValueOnce({ ...article, isPublished: true });
      articleRepo.update.mockResolvedValue(undefined);

      await service.updateArticle("kb-1", "art-1", { isPublished: true });

      expect(articleRepo.update).toHaveBeenCalledWith(
        "art-1",
        expect.objectContaining({
          isPublished: true,
          publishedArticle: article.draftArticle,
        })
      );
      expect(searchService.indexArticle).toHaveBeenCalledWith("art-1");
      expect(searchService.removeArticleFromIndex).not.toHaveBeenCalled();
    });

    it("unpublishes article that WAS published: calls searchService.removeArticleFromIndex", async () => {
      const article = makeArticle("art-1", "kb-1", true);
      articleRepo.findOne
        .mockResolvedValueOnce(article)
        .mockResolvedValueOnce({ ...article, isPublished: false });
      articleRepo.update.mockResolvedValue(undefined);

      await service.updateArticle("kb-1", "art-1", { isPublished: false });

      expect(articleRepo.update).toHaveBeenCalledWith(
        "art-1",
        expect.objectContaining({ isPublished: false })
      );
      expect(searchService.removeArticleFromIndex).toHaveBeenCalledWith("art-1");
      expect(searchService.indexArticle).not.toHaveBeenCalled();
    });

    it("sets isPublished: false for article that was NOT published: does NOT call removeArticleFromIndex", async () => {
      const article = makeArticle("art-1", "kb-1", false);
      articleRepo.findOne.mockResolvedValueOnce(article).mockResolvedValueOnce(article);
      articleRepo.update.mockResolvedValue(undefined);

      await service.updateArticle("kb-1", "art-1", { isPublished: false });

      expect(articleRepo.update).toHaveBeenCalledWith(
        "art-1",
        expect.objectContaining({ isPublished: false })
      );
      expect(searchService.removeArticleFromIndex).not.toHaveBeenCalled();
      expect(searchService.indexArticle).not.toHaveBeenCalled();
    });

    it("publishes with new content: publishedArticle uses the updated draft title", async () => {
      const article = makeArticle("art-1", "kb-1", false);
      const updatedArticle = {
        ...article,
        isPublished: true,
        draftArticle: { title: "New Title", content: "Some content" },
        publishedArticle: { title: "New Title", content: "Some content" },
      };
      articleRepo.findOne.mockResolvedValueOnce(article).mockResolvedValueOnce(updatedArticle);
      articleRepo.update.mockResolvedValue(undefined);

      await service.updateArticle("kb-1", "art-1", { title: "New Title", isPublished: true });

      expect(articleRepo.update).toHaveBeenCalledWith(
        "art-1",
        expect.objectContaining({
          isPublished: true,
          draftArticle: expect.objectContaining({ title: "New Title" }),
          publishedArticle: expect.objectContaining({ title: "New Title" }),
        })
      );
      expect(searchService.indexArticle).toHaveBeenCalledWith("art-1");
    });

    it("throws NotFoundException when article does not exist", async () => {
      articleRepo.findOne.mockResolvedValue(null);

      await expect(service.updateArticle("kb-1", "ghost-art", { title: "X" })).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws BadRequestException when body is empty (no fields to update)", async () => {
      const article = makeArticle("art-1", "kb-1", false);
      articleRepo.findOne.mockResolvedValue(article);

      await expect(service.updateArticle("kb-1", "art-1", {})).rejects.toThrow(
        BadRequestException
      );
      expect(articleRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── deleteArticle ────────────────────────────────────────────────────────

  describe("deleteArticle", () => {
    it("deletes article when it exists (unpublished)", async () => {
      const article = makeArticle("art-1", "kb-1", false);
      articleRepo.findOne.mockResolvedValue(article);
      articleRepo.delete.mockResolvedValue(undefined);

      await service.deleteArticle("kb-1", "art-1");

      expect(articleRepo.delete).toHaveBeenCalledWith("art-1");
      expect(searchService.removeArticleFromIndex).not.toHaveBeenCalled();
    });

    it("calls removeArticleFromIndex before deleting a published article", async () => {
      const article = makeArticle("art-1", "kb-1", true);
      articleRepo.findOne.mockResolvedValue(article);
      articleRepo.delete.mockResolvedValue(undefined);

      await service.deleteArticle("kb-1", "art-1");

      expect(searchService.removeArticleFromIndex).toHaveBeenCalledWith("art-1");
      expect(articleRepo.delete).toHaveBeenCalledWith("art-1");
    });

    it("still deletes article even if removeArticleFromIndex throws", async () => {
      const article = makeArticle("art-1", "kb-1", true);
      articleRepo.findOne.mockResolvedValue(article);
      articleRepo.delete.mockResolvedValue(undefined);
      searchService.removeArticleFromIndex.mockRejectedValue(new Error("index error"));

      await service.deleteArticle("kb-1", "art-1");

      expect(articleRepo.delete).toHaveBeenCalledWith("art-1");
    });

    it("throws NotFoundException when article does not exist", async () => {
      articleRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteArticle("kb-1", "ghost-art")).rejects.toThrow(NotFoundException);
    });
  });
});
