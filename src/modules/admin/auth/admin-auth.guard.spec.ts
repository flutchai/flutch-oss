import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
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

const makeContext = (authHeader?: string): ExecutionContext => {
  const request: Record<string, unknown> = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
};

describe("AdminAuthGuard", () => {
  let guard: AdminAuthGuard;
  let jwtService: { verify: jest.Mock };
  let adminAuthService: { findById: jest.Mock };

  beforeEach(async () => {
    jwtService = { verify: jest.fn() };
    adminAuthService = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: AdminAuthService, useValue: adminAuthService },
      ],
    }).compile();

    guard = module.get<AdminAuthGuard>(AdminAuthGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it("returns true and attaches adminUser when token is valid", async () => {
    const user = mockAdminUser();
    jwtService.verify.mockReturnValue({ sub: "admin-uuid-1", username: "admin" });
    adminAuthService.findById.mockResolvedValue(user);

    const ctx = makeContext("Bearer valid-token");
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect((ctx.switchToHttp().getRequest() as any).adminUser).toBe(user);
  });

  it("throws UnauthorizedException when Authorization header is missing", async () => {
    await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when token type is not Bearer", async () => {
    await expect(guard.canActivate(makeContext("Basic some-token"))).rejects.toThrow(
      UnauthorizedException
    );
  });

  it("throws UnauthorizedException when JWT verification fails", async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error("jwt expired");
    });

    await expect(guard.canActivate(makeContext("Bearer bad-token"))).rejects.toThrow(
      UnauthorizedException
    );
  });

  it("throws UnauthorizedException when user is not found", async () => {
    jwtService.verify.mockReturnValue({ sub: "ghost-id", username: "ghost" });
    adminAuthService.findById.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext("Bearer valid-token"))).rejects.toThrow(
      UnauthorizedException
    );
  });

  it("re-throws UnauthorizedException from findById without wrapping", async () => {
    jwtService.verify.mockReturnValue({ sub: "admin-uuid-1", username: "admin" });
    adminAuthService.findById.mockRejectedValue(new UnauthorizedException("User not found"));

    await expect(guard.canActivate(makeContext("Bearer valid-token"))).rejects.toThrow(
      "User not found"
    );
  });
});
