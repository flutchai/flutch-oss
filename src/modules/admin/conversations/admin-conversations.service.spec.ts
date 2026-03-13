import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AdminConversationsService } from "./admin-conversations.service";
import { Thread } from "../../database/entities/thread.entity";
import { Message, MessageDirection } from "../../database/entities/message.entity";
import { Platform } from "../../database/entities/platform.enum";

const mockThread = (id = "thread-1"): Thread & { messageCount?: number } => ({
  id,
  agentId: "agent-1",
  platform: Platform.TELEGRAM,
  userId: "user-1",
  user: null as any,
  messages: [],
  createdAt: new Date("2024-01-01"),
  messageCount: 3,
});

const mockMessage = (id = "msg-1") => ({
  id,
  threadId: "thread-1",
  content: "Hello",
  direction: MessageDirection.INCOMING,
  createdAt: new Date("2024-01-01"),
  thread: null,
});

describe("AdminConversationsService", () => {
  let service: AdminConversationsService;
  let threadRepo: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let messageRepo: { find: jest.Mock };
  let mockQb: any;

  beforeEach(async () => {
    mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      loadRelationCountAndMap: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockThread()], 1]),
    };

    threadRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      findOne: jest.fn(),
    };
    messageRepo = { find: jest.fn().mockResolvedValue([mockMessage()]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminConversationsService,
        { provide: getRepositoryToken(Thread), useValue: threadRepo },
        { provide: getRepositoryToken(Message), useValue: messageRepo },
      ],
    }).compile();

    service = module.get<AdminConversationsService>(AdminConversationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("list", () => {
    it("returns paginated threads with messageCount", async () => {
      const result = await service.list();

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: "thread-1",
        agentId: "agent-1",
        platform: Platform.TELEGRAM,
        messageCount: 3,
      });
    });

    it("applies agentId filter when provided", async () => {
      await service.list("agent-1");

      expect(mockQb.andWhere).toHaveBeenCalledWith("t.agent_id = :agentId", { agentId: "agent-1" });
    });

    it("applies platform filter when provided", async () => {
      await service.list(undefined, Platform.TELEGRAM);

      expect(mockQb.andWhere).toHaveBeenCalledWith("t.platform = :platform", {
        platform: Platform.TELEGRAM,
      });
    });

    it("caps limit at 100", async () => {
      await service.list(undefined, undefined, "1", "999");

      expect(mockQb.take).toHaveBeenCalledWith(100);
    });

    it("defaults messageCount to 0 when virtual field is undefined", async () => {
      const threadWithoutCount = { ...mockThread(), messageCount: undefined };
      mockQb.getManyAndCount.mockResolvedValue([[threadWithoutCount], 1]);

      const result = await service.list();

      expect(result.data[0].messageCount).toBe(0);
    });
  });

  describe("getThread", () => {
    it("returns thread with messages", async () => {
      const user = { id: "user-1", identities: [], createdAt: new Date(), updatedAt: new Date() };
      const thread = { ...mockThread(), user };
      threadRepo.findOne.mockResolvedValue(thread);

      const result = await service.getThread("thread-1");

      expect(result.id).toBe("thread-1");
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toMatchObject({ id: "msg-1", content: "Hello" });
    });

    it("throws NotFoundException when thread does not exist", async () => {
      threadRepo.findOne.mockResolvedValue(null);

      await expect(service.getThread("ghost-id")).rejects.toThrow(NotFoundException);
    });
  });
});
