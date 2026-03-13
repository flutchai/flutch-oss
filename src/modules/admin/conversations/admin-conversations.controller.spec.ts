import { Test, TestingModule } from "@nestjs/testing";
import { AdminConversationsController } from "./admin-conversations.controller";
import { AdminConversationsService } from "./admin-conversations.service";
import { Platform } from "../../database/entities/platform.enum";
import { AdminAuthGuard } from "../auth/admin-auth.guard";

const mockList = { data: [], total: 0, page: 1, limit: 20 };
const mockThread = {
  id: "thread-1",
  agentId: "agent-1",
  platform: Platform.TELEGRAM,
  user: null,
  createdAt: new Date(),
  messages: [],
};

describe("AdminConversationsController", () => {
  let controller: AdminConversationsController;
  let service: { list: jest.Mock; getThread: jest.Mock };

  beforeEach(async () => {
    service = {
      list: jest.fn().mockResolvedValue(mockList),
      getThread: jest.fn().mockResolvedValue(mockThread),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminConversationsController],
      providers: [{ provide: AdminConversationsService, useValue: service }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminConversationsController>(AdminConversationsController);
  });

  afterEach(() => jest.clearAllMocks());

  it("delegates list() to service", async () => {
    const result = await controller.list("agent-1", Platform.TELEGRAM, "2", "10");

    expect(service.list).toHaveBeenCalledWith("agent-1", Platform.TELEGRAM, "2", "10");
    expect(result).toBe(mockList);
  });

  it("delegates getThread() to service", async () => {
    const result = await controller.getThread("thread-1");

    expect(service.getThread).toHaveBeenCalledWith("thread-1");
    expect(result).toBe(mockThread);
  });
});
