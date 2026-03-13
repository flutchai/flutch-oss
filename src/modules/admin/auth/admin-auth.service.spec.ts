import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import { QueryFailedError } from "typeorm";
import * as bcrypt from "bcrypt";
import { AdminAuthService } from "./admin-auth.service";
import { AdminUser } from "../../database/entities/admin-user.entity";

jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
  compare: jest.fn().mockResolvedValue(true),
}));

const mockAdminUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  id: "admin-uuid-1",
  username: "admin",
  passwordHash: "hashed-password",
  passwordChanged: true,
  createdBy: null,
  creator: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("AdminAuthService", () => {
  let service: AdminAuthService;
  let adminUserRepo: any;
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    adminUserRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    jwtService = { sign: jest.fn().mockReturnValue("jwt-token") };
    configService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        { provide: getRepositoryToken(AdminUser), useValue: adminUserRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("login — bootstrap (no user in DB)", () => {
    it("creates admin user and returns token on first bootstrap login", async () => {
      configService.get.mockReturnValue("env-password");
      adminUserRepo.findOne.mockResolvedValue(null);
      adminUserRepo.create.mockReturnValue({ username: "admin" });
      adminUserRepo.save.mockResolvedValue(mockAdminUser({ passwordChanged: false }));

      const result = await service.login("admin", "env-password");

      expect(adminUserRepo.save).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result.must_change_password).toBe(true);
      expect(result.access_token).toBe("jwt-token");
    });

    it("rejects bootstrap login when password does not match env", async () => {
      configService.get.mockReturnValue("env-password");
      adminUserRepo.findOne.mockResolvedValue(null);

      await expect(service.login("admin", "wrong-password")).rejects.toThrow(UnauthorizedException);
    });

    it("rejects when no env password is set", async () => {
      configService.get.mockReturnValue(undefined);
      adminUserRepo.findOne.mockResolvedValue(null);

      await expect(service.login("admin", "any")).rejects.toThrow(UnauthorizedException);
    });

    it("handles race condition: returns token if concurrent request already created admin", async () => {
      configService.get.mockReturnValue("env-password");
      adminUserRepo.findOne
        .mockResolvedValueOnce(null) // initial check — no user
        .mockResolvedValueOnce(mockAdminUser({ passwordChanged: false })); // after race
      adminUserRepo.create.mockReturnValue({});
      const qfErr = Object.create(QueryFailedError.prototype);
      adminUserRepo.save.mockRejectedValue(qfErr);

      const result = await service.login("admin", "env-password");

      expect(result.access_token).toBe("jwt-token");
      expect(result.must_change_password).toBe(true);
    });

    it("throws UnauthorizedException when race condition but password mismatch", async () => {
      configService.get.mockReturnValue("env-password");
      adminUserRepo.findOne
        .mockResolvedValueOnce(null) // initial check
        .mockResolvedValueOnce(mockAdminUser({ passwordChanged: false })); // after race
      adminUserRepo.create.mockReturnValue({});
      const qfErr = Object.create(QueryFailedError.prototype);
      adminUserRepo.save.mockRejectedValue(qfErr);

      await expect(service.login("admin", "wrong-password")).rejects.toThrow(UnauthorizedException);
    });

    it("re-throws non-QueryFailedError from race condition path", async () => {
      configService.get.mockReturnValue("env-password");
      adminUserRepo.findOne.mockResolvedValue(null);
      adminUserRepo.create.mockReturnValue({});
      adminUserRepo.save.mockRejectedValue(new Error("DB connection lost"));

      await expect(service.login("admin", "env-password")).rejects.toThrow("DB connection lost");
    });
  });

  describe("login — existing user", () => {
    it("allows env password when admin has not changed password", async () => {
      configService.get.mockReturnValue("env-password");
      adminUserRepo.findOne.mockResolvedValue(mockAdminUser({ passwordChanged: false }));

      const result = await service.login("admin", "env-password");

      expect(result.must_change_password).toBe(true);
      expect(result.access_token).toBe("jwt-token");
    });

    it("authenticates user with bcrypt-verified password", async () => {
      configService.get.mockReturnValue("env-password");
      adminUserRepo.findOne.mockResolvedValue(mockAdminUser({ passwordChanged: true }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login("admin", "real-password");

      expect(result.must_change_password).toBe(false);
      expect(result.access_token).toBe("jwt-token");
    });

    it("rejects when bcrypt compare fails", async () => {
      configService.get.mockReturnValue("env-password");
      adminUserRepo.findOne.mockResolvedValue(mockAdminUser({ passwordChanged: true }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login("admin", "bad-password")).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("changePassword", () => {
    it("changes password successfully", async () => {
      configService.get.mockReturnValue("env-password");
      const user = mockAdminUser({ passwordChanged: true });
      adminUserRepo.findOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      adminUserRepo.save.mockResolvedValue({ ...user, passwordChanged: true });

      await service.changePassword("admin-uuid-1", "old-pass", "new-password-long");

      expect(adminUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ passwordChanged: true, passwordHash: "hashed-password" })
      );
    });

    it("accepts env password as current password for first-time change", async () => {
      configService.get.mockReturnValue("env-password");
      const user = mockAdminUser({ passwordChanged: false });
      adminUserRepo.findOne.mockResolvedValue(user);
      adminUserRepo.save.mockResolvedValue(user);

      await expect(
        service.changePassword("admin-uuid-1", "env-password", "new-password-long")
      ).resolves.not.toThrow();
    });

    it("rejects password shorter than 8 characters", async () => {
      adminUserRepo.findOne.mockResolvedValue(mockAdminUser());

      await expect(service.changePassword("admin-uuid-1", "any-current", "short")).rejects.toThrow(
        BadRequestException
      );
    });

    it("rejects when current password is incorrect", async () => {
      configService.get.mockReturnValue("env-password");
      adminUserRepo.findOne.mockResolvedValue(mockAdminUser({ passwordChanged: true }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword("admin-uuid-1", "wrong-current", "new-password-long")
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException when user not found", async () => {
      adminUserRepo.findOne.mockResolvedValue(null);

      await expect(service.changePassword("ghost-id", "any", "new-password-long")).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe("findById", () => {
    it("returns admin user by id", async () => {
      const user = mockAdminUser();
      adminUserRepo.findOne.mockResolvedValue(user);

      const result = await service.findById("admin-uuid-1");

      expect(result).toBe(user);
      expect(adminUserRepo.findOne).toHaveBeenCalledWith({ where: { id: "admin-uuid-1" } });
    });

    it("returns null when user not found", async () => {
      adminUserRepo.findOne.mockResolvedValue(null);

      const result = await service.findById("ghost-id");

      expect(result).toBeNull();
    });
  });
});
