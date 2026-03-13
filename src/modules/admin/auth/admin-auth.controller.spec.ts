import { Test, TestingModule } from "@nestjs/testing";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminUser } from "../../database/entities/admin-user.entity";

const mockAdminUser = (): AdminUser => ({
  id: "admin-uuid-1",
  username: "admin",
  passwordHash: "hashed",
  passwordChanged: true,
  createdBy: null,
  creator: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("AdminAuthController", () => {
  let controller: AdminAuthController;
  let authService: { login: jest.Mock; changePassword: jest.Mock };

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue({ access_token: "jwt", must_change_password: false }),
      changePassword: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthController],
      providers: [{ provide: AdminAuthService, useValue: authService }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminAuthController>(AdminAuthController);
  });

  afterEach(() => jest.clearAllMocks());

  describe("login", () => {
    it("delegates to authService.login and returns token", async () => {
      const result = await controller.login({ username: "admin", password: "pass" } as any);

      expect(authService.login).toHaveBeenCalledWith("admin", "pass");
      expect(result).toEqual({ access_token: "jwt", must_change_password: false });
    });

  });

  describe("changePassword", () => {
    it("delegates to authService.changePassword and returns success", async () => {
      const req = { adminUser: mockAdminUser() };
      const result = await controller.changePassword(
        { currentPassword: "old", newPassword: "new-pass-long" } as any,
        req
      );

      expect(authService.changePassword).toHaveBeenCalledWith(
        "admin-uuid-1",
        "old",
        "new-pass-long"
      );
      expect(result).toEqual({ success: true });
    });

  });
});
