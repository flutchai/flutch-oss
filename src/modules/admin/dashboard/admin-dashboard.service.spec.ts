import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AdminDashboardService } from "./admin-dashboard.service";
import { Thread } from "../../database/entities/thread.entity";
import { Message, MessageDirection } from "../../database/entities/message.entity";
import { User } from "../../database/entities/user.entity";
import { AgentConfigService } from "../../config/agent-config.service";

describe("AdminDashboardService", () => {
  let service: AdminDashboardService;
  let threadRepo: { count: jest.Mock };
  let messageRepo: { count: jest.Mock; find: jest.Mock };
  let userRepo: { count: jest.Mock };
  let agentConfigService: { getAgentCount: jest.Mock };

  beforeEach(async () => {
    threadRepo = { count: jest.fn().mockResolvedValue(5) };
    messageRepo = { count: jest.fn().mockResolvedValue(20), find: jest.fn().mockResolvedValue([]) };
    userRepo = { count: jest.fn().mockResolvedValue(10) };
    agentConfigService = { getAgentCount: jest.fn().mockReturnValue(2) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        { provide: getRepositoryToken(Thread), useValue: threadRepo },
        { provide: getRepositoryToken(Message), useValue: messageRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AgentConfigService, useValue: agentConfigService },
      ],
    }).compile();

    service = module.get<AdminDashboardService>(AdminDashboardService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("getStats", () => {
    it("returns aggregated stats from repositories", async () => {
      const result = await service.getStats();

      expect(result).toMatchObject({
        threads_today: 5,
        messages_today: 20,
        users_total: 10,
        total_threads: 5,
        agents_count: 2,
      });
    });

    it("returns null for agents_count in platform mode", async () => {
      agentConfigService.getAgentCount.mockReturnValue(null);

      const result = await service.getStats();

      expect(result.agents_count).toBeNull();
    });
  });

  describe("getStatus", () => {
    it("returns engine: true, database: true when userRepo.count succeeds", async () => {
      const result = await service.getStatus();

      expect(result).toEqual({ engine: true, database: true, ragflow: false });
    });

    it("returns database: false when userRepo.count throws", async () => {
      userRepo.count.mockRejectedValue(new Error("connection refused"));

      const result = await service.getStatus();

      expect(result).toEqual({ engine: true, database: false, ragflow: false });
    });
  });

  describe("getRecentActivity", () => {
    it("returns mapped activity items", async () => {
      messageRepo.find.mockResolvedValue([
        {
          id: "msg-1",
          threadId: "thread-1",
          content: "Hello world",
          direction: MessageDirection.INCOMING,
          createdAt: new Date("2024-01-01"),
          thread: { agentId: "agent-1", platform: "telegram" },
        },
      ]);

      const result = await service.getRecentActivity();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "msg-1",
        threadId: "thread-1",
        agentId: "agent-1",
        platform: "telegram",
        preview: "Hello world",
      });
    });

    it("truncates preview to 80 characters", async () => {
      const longContent = "a".repeat(120);
      messageRepo.find.mockResolvedValue([
        {
          id: "msg-1",
          threadId: "t-1",
          content: longContent,
          direction: MessageDirection.INCOMING,
          createdAt: new Date(),
          thread: { agentId: "a-1", platform: "telegram" },
        },
      ]);

      const result = await service.getRecentActivity();

      expect(result[0].preview).toHaveLength(80);
    });
  });
});
