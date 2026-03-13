import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AdminUsersService } from "./admin-users.service";
import { User } from "../../database/entities/user.entity";
import { UserService } from "../../platform-connector/user.service";
import { Platform } from "../../database/entities/platform.enum";

const mockUser = (id = "user-1"): User => ({
  id,
  identities: [],
  threads: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
});

describe("AdminUsersService", () => {
  let service: AdminUsersService;
  let userRepo: { findAndCount: jest.Mock; findOne: jest.Mock };
  let userService: { mergeUsers: jest.Mock };

  beforeEach(async () => {
    userRepo = {
      findAndCount: jest.fn().mockResolvedValue([[mockUser()], 1]),
      findOne: jest.fn(),
    };
    userService = { mergeUsers: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("list", () => {
    it("returns paginated users", async () => {
      const result = await service.list();

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ id: "user-1" });
    });

    it("maps identities correctly", async () => {
      const user = mockUser();
      user.identities = [
        {
          id: "id-1",
          userId: "user-1",
          platform: Platform.TELEGRAM,
          externalId: "12345",
          metadata: { firstName: "Ivan" },
          user: user,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      userRepo.findAndCount.mockResolvedValue([[user], 1]);

      const result = await service.list();

      expect(result.data[0].identities?.[0]).toMatchObject({
        platform: Platform.TELEGRAM,
        externalId: "12345",
        metadata: { firstName: "Ivan" },
      });
    });

    it("caps limit at 100", async () => {
      await service.list("1", "999");

      expect(userRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });
  });

  describe("getUser", () => {
    it("returns user with identities and threads", async () => {
      const user = mockUser();
      user.threads = [
        {
          id: "t-1",
          agentId: "agent-1",
          platform: Platform.TELEGRAM,
          userId: "user-1",
          user: user,
          messages: [],
          createdAt: new Date(),
        },
      ];
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.getUser("user-1");

      expect(result.id).toBe("user-1");
      expect(result.threads).toHaveLength(1);
    });

    it("throws NotFoundException when user not found", async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getUser("ghost-id")).rejects.toThrow(NotFoundException);
    });
  });

  describe("mergeUsers", () => {
    it("calls userService.mergeUsers and returns success", async () => {
      const result = await service.mergeUsers("source-id", "target-id");

      expect(userService.mergeUsers).toHaveBeenCalledWith("source-id", "target-id");
      expect(result).toEqual({ success: true });
    });

    it("throws BadRequestException when sourceId is missing", async () => {
      await expect(service.mergeUsers("", "target-id")).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when targetId is missing", async () => {
      await expect(service.mergeUsers("source-id", "")).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when sourceId equals targetId", async () => {
      await expect(service.mergeUsers("same-id", "same-id")).rejects.toThrow(BadRequestException);
    });
  });
});
