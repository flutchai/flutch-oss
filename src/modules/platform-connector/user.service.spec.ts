import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import { UserService } from "./user.service";
import { User } from "../database/entities/user.entity";
import { UserIdentity } from "../database/entities/user-identity.entity";
import { Platform } from "../database/entities/thread.entity";

const mockUser = (id = "user-uuid-1"): User => ({ id, identities: [], threads: [], createdAt: new Date(), updatedAt: new Date() });
const mockIdentity = (userId = "user-uuid-1"): UserIdentity => ({
  id: "identity-uuid-1",
  userId,
  platform: Platform.TELEGRAM,
  externalId: "12345",
  metadata: null,
  user: mockUser(userId),
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("UserService", () => {
  let service: UserService;
  let userRepo: any;
  let identityRepo: Record<string, jest.Mock>;
  const mockEntityManager = { getRepository: jest.fn() };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      manager: mockEntityManager,
    };
    identityRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(UserIdentity), useValue: identityRepo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("findOrCreateByIdentity", () => {
    it("returns existing user when identity is found", async () => {
      const user = mockUser();
      const identity = mockIdentity();
      identityRepo.findOne.mockResolvedValue(identity);

      const result = await service.findOrCreateByIdentity(Platform.TELEGRAM, "12345");

      expect(identityRepo.findOne).toHaveBeenCalledWith({
        where: { platform: Platform.TELEGRAM, externalId: "12345" },
        relations: ["user"],
      });
      expect(result).toBe(identity.user);
      expect(userRepo.create).not.toHaveBeenCalled();
    });

    it("updates metadata on existing identity when provided", async () => {
      const identity = mockIdentity();
      identityRepo.findOne.mockResolvedValue(identity);
      identityRepo.save.mockResolvedValue({ ...identity, metadata: { firstName: "Ivan" } });

      await service.findOrCreateByIdentity(Platform.TELEGRAM, "12345", { firstName: "Ivan" });

      expect(identityRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ firstName: "Ivan" }) }),
      );
    });

    it("does not call save when no metadata provided for existing identity", async () => {
      identityRepo.findOne.mockResolvedValue(mockIdentity());

      await service.findOrCreateByIdentity(Platform.TELEGRAM, "12345");

      expect(identityRepo.save).not.toHaveBeenCalled();
    });

    it("creates new user and identity when not found", async () => {
      const newUser = mockUser("new-user-uuid");
      identityRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue({ id: undefined });
      userRepo.save.mockResolvedValue(newUser);
      identityRepo.create.mockReturnValue({ userId: newUser.id, platform: Platform.TELEGRAM, externalId: "99999" });
      identityRepo.save.mockResolvedValue({});

      const result = await service.findOrCreateByIdentity(Platform.TELEGRAM, "99999", { firstName: "Maria" });

      expect(userRepo.save).toHaveBeenCalled();
      expect(identityRepo.create).toHaveBeenCalledWith({
        userId: newUser.id,
        platform: Platform.TELEGRAM,
        externalId: "99999",
        metadata: { firstName: "Maria" },
      });
      expect(identityRepo.save).toHaveBeenCalled();
      expect(result).toBe(newUser);
    });

    it("creates identity with null metadata when none provided", async () => {
      const newUser = mockUser();
      identityRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue({});
      userRepo.save.mockResolvedValue(newUser);
      identityRepo.create.mockReturnValue({});
      identityRepo.save.mockResolvedValue({});

      await service.findOrCreateByIdentity(Platform.WIDGET, "fingerprint-abc");

      expect(identityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: null }),
      );
    });
  });

  describe("mergeUsers", () => {
    const mockThreadsRepo = { update: jest.fn() };

    beforeEach(() => {
      mockEntityManager.getRepository.mockReturnValue(mockThreadsRepo);
    });

    it("reassigns identities and threads, then deletes source", async () => {
      const source = { ...mockUser("source-id"), identities: [mockIdentity("source-id")] };
      const target = mockUser("target-id");

      userRepo.findOne
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(target);
      identityRepo.update.mockResolvedValue({});
      mockThreadsRepo.update.mockResolvedValue({});
      userRepo.delete.mockResolvedValue({});

      await service.mergeUsers("source-id", "target-id");

      expect(identityRepo.update).toHaveBeenCalledWith({ userId: "source-id" }, { userId: "target-id" });
      expect(mockThreadsRepo.update).toHaveBeenCalledWith({ userId: "source-id" }, { userId: "target-id" });
      expect(userRepo.delete).toHaveBeenCalledWith("source-id");
    });

    it("skips identity update when source has no identities", async () => {
      const source = { ...mockUser("source-id"), identities: [] };
      userRepo.findOne
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(mockUser("target-id"));
      mockThreadsRepo.update.mockResolvedValue({});
      userRepo.delete.mockResolvedValue({});

      await service.mergeUsers("source-id", "target-id");

      expect(identityRepo.update).not.toHaveBeenCalled();
      expect(userRepo.delete).toHaveBeenCalledWith("source-id");
    });

    it("throws NotFoundException when source user does not exist", async () => {
      userRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser("target-id"));

      await expect(service.mergeUsers("ghost-id", "target-id")).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when target user does not exist", async () => {
      userRepo.findOne
        .mockResolvedValueOnce(mockUser("source-id"))
        .mockResolvedValueOnce(null);

      await expect(service.mergeUsers("source-id", "ghost-id")).rejects.toThrow(NotFoundException);
    });
  });
});
