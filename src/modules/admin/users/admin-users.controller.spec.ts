import { Test, TestingModule } from "@nestjs/testing";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminAuthGuard } from "../auth/admin-auth.guard";

const mockList = { data: [], total: 0, page: 1, limit: 20 };
const mockUser = {
  id: "user-1",
  identities: [],
  threads: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("AdminUsersController", () => {
  let controller: AdminUsersController;
  let service: { list: jest.Mock; getUser: jest.Mock; mergeUsers: jest.Mock };

  beforeEach(async () => {
    service = {
      list: jest.fn().mockResolvedValue(mockList),
      getUser: jest.fn().mockResolvedValue(mockUser),
      mergeUsers: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: AdminUsersService, useValue: service }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
  });

  afterEach(() => jest.clearAllMocks());

  it("delegates list() to service", async () => {
    const result = await controller.list("2", "10");

    expect(service.list).toHaveBeenCalledWith("2", "10");
    expect(result).toBe(mockList);
  });

  it("delegates getUser() to service", async () => {
    const result = await controller.getUser("user-1");

    expect(service.getUser).toHaveBeenCalledWith("user-1");
    expect(result).toBe(mockUser);
  });

  it("delegates mergeUsers() to service", async () => {
    const result = await controller.mergeUsers({ sourceId: "src", targetId: "tgt" });

    expect(service.mergeUsers).toHaveBeenCalledWith("src", "tgt");
    expect(result).toEqual({ success: true });
  });
});
