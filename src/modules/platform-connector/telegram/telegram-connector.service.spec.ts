import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { TelegramConnectorService } from "./telegram-connector.service";
import { TelegramApiClient } from "./telegram-api.client";
import { AgentConfigService } from "../../config/agent-config.service";
import { ThreadService } from "../thread.service";
import { Platform } from "../../database/entities/thread.entity";
import { MessageDirection } from "../../database/entities/message.entity";
import { TelegramUpdate } from "./telegram.types";

const mockThread = {
  id: "thread-uuid",
  agentId: "roofing-agent",
  userId: "111111",
  platform: Platform.TELEGRAM,
  createdAt: new Date(),
};

const mockContext = {
  agentId: "roofing-agent",
  userId: "111111",
  threadId: "roofing-agent:111111",
  graphType: "flutch.agent",
  graphSettings: { model: "gpt-4o-mini" },
};

const mockConfig = {
  agentId: "roofing-agent",
  graphType: "flutch.agent",
  graphSettings: { model: "gpt-4o-mini" },
  platforms: { telegram: { botToken: "config-bot-token" } },
};

const mockGraphResult = {
  requestId: "req-1",
  text: "Кровля стоит 500$",
  metadata: { usageMetrics: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
};

const textUpdate: TelegramUpdate = {
  update_id: 1,
  message: {
    message_id: 10,
    from: { id: 111111, first_name: "Ivan" },
    chat: { id: 111111, type: "private" },
    text: "Сколько стоит кровля?",
    date: 1700000000,
  },
};

describe("TelegramConnectorService", () => {
  let service: TelegramConnectorService;
  let agentConfigService: jest.Mocked<AgentConfigService>;
  let threadService: { findOrCreate: jest.Mock; saveMessage: jest.Mock };
  let telegramApiClient: jest.Mocked<TelegramApiClient>;
  let graphService: { generateAnswer: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    graphService = { generateAnswer: jest.fn().mockResolvedValue(mockGraphResult) };
    configService = { get: jest.fn().mockReturnValue(undefined) };
    threadService = {
      findOrCreate: jest.fn().mockResolvedValue(mockThread),
      saveMessage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramConnectorService,
        {
          provide: AgentConfigService,
          useValue: {
            resolve: jest.fn().mockResolvedValue(mockContext),
            getConfig: jest.fn().mockResolvedValue(mockConfig),
          },
        },
        { provide: ThreadService, useValue: threadService },
        {
          provide: TelegramApiClient,
          useValue: { sendMessage: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: ConfigService, useValue: configService },
        { provide: "GRAPH_SERVICE", useValue: graphService },
      ],
    }).compile();

    service = module.get<TelegramConnectorService>(TelegramConnectorService);
    agentConfigService = module.get(AgentConfigService);
    telegramApiClient = module.get(TelegramApiClient);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("handleUpdate — message routing", () => {
    it("should skip update with no message and no callback_query", async () => {
      await service.handleUpdate("roofing-agent", { update_id: 1 } as any);
      expect(graphService.generateAnswer).not.toHaveBeenCalled();
      expect(threadService.findOrCreate).not.toHaveBeenCalled();
    });

    it("should skip message with no text", async () => {
      const update: TelegramUpdate = {
        update_id: 2,
        message: { message_id: 1, chat: { id: 111, type: "private" }, date: 0 },
      };
      await service.handleUpdate("roofing-agent", update);
      expect(graphService.generateAnswer).not.toHaveBeenCalled();
    });

    it("should handle text message end-to-end", async () => {
      await service.handleUpdate("roofing-agent", textUpdate);
      expect(graphService.generateAnswer).toHaveBeenCalledTimes(1);
    });

    it("should handle callback_query with data", async () => {
      const cbUpdate: TelegramUpdate = {
        update_id: 3,
        callback_query: {
          id: "cb1",
          from: { id: 222222, first_name: "Test" },
          message: { message_id: 5, chat: { id: 222222, type: "private" }, date: 0 },
          data: "button_clicked",
        },
      };
      await service.handleUpdate("roofing-agent", cbUpdate);
      expect(graphService.generateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ input: "button_clicked" })
      );
    });

    it("should skip callback_query with no data", async () => {
      const cbUpdate: TelegramUpdate = {
        update_id: 4,
        callback_query: {
          id: "cb2",
          from: { id: 222222, first_name: "Test" },
          message: { message_id: 5, chat: { id: 222222, type: "private" }, date: 0 },
        },
      };
      await service.handleUpdate("roofing-agent", cbUpdate);
      expect(graphService.generateAnswer).not.toHaveBeenCalled();
    });
  });

  describe("handleUpdate — thread + message persistence", () => {
    it("should call findOrCreate with agentId, chatId and TELEGRAM platform", async () => {
      await service.handleUpdate("roofing-agent", textUpdate);
      expect(threadService.findOrCreate).toHaveBeenCalledWith(
        "roofing-agent",
        "111111",
        Platform.TELEGRAM
      );
    });

    it("should save incoming message before calling engine", async () => {
      const callOrder: string[] = [];
      threadService.saveMessage.mockImplementation(async (_id, _content, direction) => {
        callOrder.push(`save:${direction}`);
      });
      graphService.generateAnswer.mockImplementation(async () => {
        callOrder.push("engine");
        return mockGraphResult;
      });

      await service.handleUpdate("roofing-agent", textUpdate);

      expect(callOrder[0]).toBe(`save:${MessageDirection.INCOMING}`);
      expect(callOrder[1]).toBe("engine");
    });

    it("should save outgoing message after engine responds", async () => {
      await service.handleUpdate("roofing-agent", textUpdate);
      expect(threadService.saveMessage).toHaveBeenCalledWith(
        "thread-uuid",
        "Кровля стоит 500$",
        MessageDirection.OUTGOING
      );
    });

    it("should use thread.id as thread_id in engine payload (not agentId:userId)", async () => {
      await service.handleUpdate("roofing-agent", textUpdate);
      expect(graphService.generateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            configurable: expect.objectContaining({ thread_id: "thread-uuid" }),
          }),
        })
      );
    });
  });

  describe("handleUpdate — engine payload", () => {
    it("should resolve context with chatId as userId", async () => {
      await service.handleUpdate("roofing-agent", textUpdate);
      expect(agentConfigService.resolve).toHaveBeenCalledWith("roofing-agent", "111111");
    });

    it("should include platform metadata in payload", async () => {
      await service.handleUpdate("roofing-agent", textUpdate);
      expect(graphService.generateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            configurable: expect.objectContaining({
              metadata: expect.objectContaining({ platform: "telegram" }),
            }),
          }),
        })
      );
    });

    it("should generate a unique requestId per call", async () => {
      await service.handleUpdate("roofing-agent", textUpdate);
      await service.handleUpdate("roofing-agent", textUpdate);
      const [call1, call2] = graphService.generateAnswer.mock.calls;
      expect(call1[0].requestId).not.toBe(call2[0].requestId);
    });
  });

  describe("handleUpdate — Telegram response", () => {
    it("should send AI response to the correct chatId", async () => {
      await service.handleUpdate("roofing-agent", textUpdate);
      expect(telegramApiClient.sendMessage).toHaveBeenCalledWith(
        "config-bot-token",
        111111,
        "Кровля стоит 500$"
      );
    });
  });

  describe("resolveBotToken", () => {
    it("should prefer per-agent env var over config", async () => {
      configService.get.mockImplementation((key: string) =>
        key === "TELEGRAM_BOT_TOKEN_ROOFING_AGENT" ? "env-token" : undefined
      );
      await service.handleUpdate("roofing-agent", textUpdate);
      expect(telegramApiClient.sendMessage).toHaveBeenCalledWith(
        "env-token",
        111111,
        expect.any(String)
      );
    });

    it("should fall back to config file token when no env var", async () => {
      await service.handleUpdate("roofing-agent", textUpdate);
      expect(telegramApiClient.sendMessage).toHaveBeenCalledWith(
        "config-bot-token",
        111111,
        expect.any(String)
      );
    });

    it("should throw when no token is configured", async () => {
      (agentConfigService.getConfig as jest.Mock).mockResolvedValue({
        ...mockConfig,
        platforms: undefined,
      });
      await expect(service.handleUpdate("roofing-agent", textUpdate)).rejects.toThrow(
        'No Telegram bot token configured for agent "roofing-agent"'
      );
    });
  });
});
