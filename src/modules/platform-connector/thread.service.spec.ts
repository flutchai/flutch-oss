import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ThreadService } from "./thread.service";
import { Thread, Platform } from "../database/entities/thread.entity";
import { Message, MessageDirection } from "../database/entities/message.entity";

const mockThread: Thread = {
  id: "thread-uuid",
  agentId: "roofing-agent",
  userId: "111111",
  platform: Platform.TELEGRAM,
  createdAt: new Date(),
  messages: [],
};

const mockMessage: Message = {
  id: "msg-uuid",
  threadId: "thread-uuid",
  content: "Hello",
  direction: MessageDirection.INCOMING,
  createdAt: new Date(),
  thread: mockThread,
};

describe("ThreadService", () => {
  let service: ThreadService;
  let threadRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let messageRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    threadRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockReturnValue(mockThread),
      save: jest.fn().mockResolvedValue(mockThread),
    };
    messageRepo = {
      create: jest.fn().mockReturnValue(mockMessage),
      save: jest.fn().mockResolvedValue(mockMessage),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreadService,
        { provide: getRepositoryToken(Thread), useValue: threadRepo },
        { provide: getRepositoryToken(Message), useValue: messageRepo },
      ],
    }).compile();

    service = module.get<ThreadService>(ThreadService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findOrCreate", () => {
    it("should return existing thread when found", async () => {
      threadRepo.findOne.mockResolvedValue(mockThread);

      const result = await service.findOrCreate("roofing-agent", "111111", Platform.TELEGRAM);

      expect(threadRepo.findOne).toHaveBeenCalledWith({
        where: { agentId: "roofing-agent", userId: "111111", platform: Platform.TELEGRAM },
      });
      expect(threadRepo.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockThread);
    });

    it("should create a new thread when not found", async () => {
      threadRepo.findOne.mockResolvedValue(null);

      const result = await service.findOrCreate("roofing-agent", "111111", Platform.TELEGRAM);

      expect(threadRepo.create).toHaveBeenCalledWith({
        agentId: "roofing-agent",
        userId: "111111",
        platform: Platform.TELEGRAM,
      });
      expect(threadRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockThread);
    });

    it("should not save when thread already exists", async () => {
      threadRepo.findOne.mockResolvedValue(mockThread);

      await service.findOrCreate("roofing-agent", "111111", Platform.TELEGRAM);

      expect(threadRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("saveMessage", () => {
    it("should create and save a message", async () => {
      const result = await service.saveMessage("thread-uuid", "Hello", MessageDirection.INCOMING);

      expect(messageRepo.create).toHaveBeenCalledWith({
        threadId: "thread-uuid",
        content: "Hello",
        direction: MessageDirection.INCOMING,
      });
      expect(messageRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockMessage);
    });

    it("should save outgoing messages", async () => {
      await service.saveMessage("thread-uuid", "AI response", MessageDirection.OUTGOING);

      expect(messageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ direction: MessageDirection.OUTGOING })
      );
    });
  });
});
