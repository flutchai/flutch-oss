import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  KnowledgeBaseOwnership,
  KnowledgeBaseStatus,
  KnowledgeBaseContentType,
  VisibilityLevel,
} from "@flutchai/knowledge";
import { KbRepository } from "./kb.repository";
import { KnowledgeBase } from "../entities/knowledge-base.entity";

const makeKb = (id = "kb-1"): KnowledgeBase =>
  ({
    id,
    name: "Test KB",
    description: "A description",
    ownership: KnowledgeBaseOwnership.PERSONAL,
    visibility: VisibilityLevel.PRIVATE,
    visibilityStatus: KnowledgeBaseStatus.DRAFT,
    contentType: KnowledgeBaseContentType.GENERAL,
    ownerId: "owner-1",
    companyId: "company-1",
    settings: {},
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  }) as KnowledgeBase;

describe("KbRepository", () => {
  let repository: KbRepository;
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
      providers: [KbRepository, { provide: getRepositoryToken(KnowledgeBase), useValue: repo }],
    }).compile();

    repository = module.get<KbRepository>(KbRepository);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── findById ─────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("returns entity when found", async () => {
      const kb = makeKb("kb-1");
      repo.findOne.mockResolvedValue(kb);

      const result = await repository.findById("kb-1");

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: "kb-1" } });
      expect(result).toBe(kb);
    });

    it("returns null when not found", async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await repository.findById("ghost-id");

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: "ghost-id" } });
      expect(result).toBeNull();
    });
  });

  // ─── findByCompany ────────────────────────────────────────────────────────

  describe("findByCompany", () => {
    it("calls findAndCount with correct where/skip/take and returns paginated result", async () => {
      const kb = makeKb("kb-1");
      repo.findAndCount.mockResolvedValue([[kb], 1]);

      const result = await repository.findByCompany("company-1", { page: 2, limit: 10 });

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { companyId: "company-1" },
        skip: 10,
        take: 10,
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual({ items: [kb], total: 1, page: 2, limit: 10 });
    });

    it("defaults to page 1 and limit 20 when options are not provided", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await repository.findByCompany("company-1", {});

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { companyId: "company-1" },
        skip: 0,
        take: 20,
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    });

    it("returns correct items and total from the underlying repo", async () => {
      const kbs = [makeKb("kb-1"), makeKb("kb-2")];
      repo.findAndCount.mockResolvedValue([kbs, 5]);

      const result = await repository.findByCompany("company-1", { page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
    });
  });

  // ─── findByOwner ──────────────────────────────────────────────────────────

  describe("findByOwner", () => {
    it("calls findAndCount with correct where/skip/take and returns paginated result", async () => {
      const kb = makeKb("kb-1");
      repo.findAndCount.mockResolvedValue([[kb], 1]);

      const result = await repository.findByOwner("owner-1", { page: 1, limit: 5 });

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { ownerId: "owner-1" },
        skip: 0,
        take: 5,
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual({ items: [kb], total: 1, page: 1, limit: 5 });
    });

    it("defaults to page 1 and limit 20 when options are not provided", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await repository.findByOwner("owner-1", {});

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 })
      );
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("calculates skip correctly for page 3", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await repository.findByOwner("owner-1", { page: 3, limit: 10 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      );
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe("create", () => {
    it("calls repo.create and repo.save, then returns the saved entity", async () => {
      const data = {
        name: "New KB",
        ownership: KnowledgeBaseOwnership.PERSONAL,
        visibility: VisibilityLevel.PRIVATE,
        visibilityStatus: KnowledgeBaseStatus.DRAFT,
        contentType: KnowledgeBaseContentType.GENERAL,
      };
      const entity = makeKb("kb-new");
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
      const updated = makeKb("kb-1");
      updated.name = "Updated Name";
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValue(updated);

      const result = await repository.update("kb-1", { name: "Updated Name" });

      expect(repo.update).toHaveBeenCalledWith("kb-1", { name: "Updated Name" });
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: "kb-1" } });
      expect(result).toBe(updated);
    });

    it("returns null when findById returns null after update", async () => {
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValue(null);

      const result = await repository.update("ghost-id", { name: "X" });

      expect(repo.update).toHaveBeenCalledWith("ghost-id", { name: "X" });
      expect(result).toBeNull();
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("calls repo.delete with the given id", async () => {
      repo.delete.mockResolvedValue(undefined);

      await repository.delete("kb-1");

      expect(repo.delete).toHaveBeenCalledWith("kb-1");
    });

    it("resolves without throwing even if the entity does not exist", async () => {
      repo.delete.mockResolvedValue({ affected: 0 });

      await expect(repository.delete("ghost-id")).resolves.toBeUndefined();
    });
  });
});
