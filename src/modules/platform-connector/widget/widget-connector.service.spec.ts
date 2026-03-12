import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { WidgetConnectorService } from "./widget-connector.service";
import { AgentConfigService } from "../../config/agent-config.service";
import { UserService } from "../user.service";
import { ThreadService } from "../thread.service";
import { Platform } from "../../database/entities/thread.entity";
import { MessageDirection } from "../../database/entities/message.entity";

const mockUser = {
  id: "user-uuid-1",
  identities: [],
  threads: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};
const mockThread = {
  id: "thread-uuid-1",
  agentId: "roofing-agent",
  userId: mockUser.id,
  platform: Platform.WIDGET,
  createdAt: new Date(),
};
const mockConfig = {
  agentId: "roofing-agent",
  graphType: "flutch.agent",
  graphSettings: { model: "gpt-4o-mini" },
  platforms: { widget: { widgetKey: "wk_test" } },
};
const mockContext = {
  agentId: "roofing-agent",
  userId: mockUser.id,
  threadId: "thread-uuid-1",
  graphType: "flutch.agent",
  graphSettings: { model: "gpt-4o-mini" },
};
const mockResult = { requestId: "req-1", text: "Кровля стоит 500$", metadata: {} };

function makeMockRes() {
  return {
    set: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  };
}

function makeMockReq(onClose?: () => void) {
  return {
    on: jest.fn((event: string, cb: () => void) => {
      if (event === "close" && onClose) onClose = cb;
    }),
  };
}

describe("WidgetConnectorService", () => {
  let service: WidgetConnectorService;
  let agentConfigService: { resolveByWidgetKey: jest.Mock; resolve: jest.Mock };
  let userService: { findOrCreateByIdentity: jest.Mock };
  let threadService: { findOrCreate: jest.Mock; saveMessage: jest.Mock };
  let graphService: { streamAnswer: jest.Mock };

  beforeEach(async () => {
    agentConfigService = {
      resolveByWidgetKey: jest.fn().mockResolvedValue(mockConfig),
      resolve: jest.fn().mockResolvedValue(mockContext),
    };
    userService = { findOrCreateByIdentity: jest.fn().mockResolvedValue(mockUser) };
    threadService = {
      findOrCreate: jest.fn().mockResolvedValue(mockThread),
      saveMessage: jest.fn().mockResolvedValue(undefined),
    };
    graphService = {
      streamAnswer: jest.fn().mockImplementation(async (_p, onPartial) => {
        onPartial("Кровля ");
        onPartial("стоит 500$");
        return mockResult;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WidgetConnectorService,
        { provide: AgentConfigService, useValue: agentConfigService },
        { provide: UserService, useValue: userService },
        { provide: ThreadService, useValue: threadService },
        { provide: "GRAPH_SERVICE", useValue: graphService },
      ],
    }).compile();

    service = module.get<WidgetConnectorService>(WidgetConnectorService);
  });

  afterEach(() => jest.clearAllMocks());

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  // ── init ─────────────────────────────────────────────────────────────────

  describe("init", () => {
    it("creates user by fingerprint and returns threadId", async () => {
      const result = await service.init({ widgetKey: "wk_test", fingerprint: "fp-abc" });

      expect(userService.findOrCreateByIdentity).toHaveBeenCalledWith(Platform.WIDGET, "fp-abc");
      expect(result.threadId).toBe("thread-uuid-1");
      expect(typeof result.sessionToken).toBe("string");
      expect(result.sessionToken).toBeTruthy();
    });

    it("reuses existing thread on repeated init", async () => {
      await service.init({ widgetKey: "wk_test", fingerprint: "fp-abc" });
      await service.init({ widgetKey: "wk_test", fingerprint: "fp-abc" });

      expect(threadService.findOrCreate).toHaveBeenCalledTimes(2);
    });

    it("accepts matching threadId without error", async () => {
      await expect(
        service.init({ widgetKey: "wk_test", fingerprint: "fp-abc", threadId: "thread-uuid-1" })
      ).resolves.not.toThrow();
    });

    it("throws BadRequestException when threadId does not match", async () => {
      await expect(
        service.init({ widgetKey: "wk_test", fingerprint: "fp-abc", threadId: "wrong-thread-id" })
      ).rejects.toThrow(BadRequestException);
    });

    it("resolves agent by widgetKey", async () => {
      await service.init({ widgetKey: "wk_test", fingerprint: "fp-abc" });
      expect(agentConfigService.resolveByWidgetKey).toHaveBeenCalledWith("wk_test");
    });

    it("returns unique sessionToken each call", async () => {
      const r1 = await service.init({ widgetKey: "wk_test", fingerprint: "fp-abc" });
      const r2 = await service.init({ widgetKey: "wk_test", fingerprint: "fp-abc" });
      expect(r1.sessionToken).not.toBe(r2.sessionToken);
    });
  });

  // ── sendMessage ───────────────────────────────────────────────────────────

  describe("sendMessage", () => {
    it("sets SSE headers and flushes before streaming", async () => {
      const res = makeMockRes();
      const req = makeMockReq();

      await service.sendMessage(
        { widgetKey: "wk_test", threadId: "thread-uuid-1", text: "Привет" },
        req as any,
        res as any
      );

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        })
      );
      expect(res.flushHeaders).toHaveBeenCalled();
    });

    it("calls streamAnswer (not generateAnswer)", async () => {
      const res = makeMockRes();
      const req = makeMockReq();

      await service.sendMessage(
        { widgetKey: "wk_test", threadId: "thread-uuid-1", text: "Вопрос" },
        req as any,
        res as any
      );

      expect(graphService.streamAnswer).toHaveBeenCalledTimes(1);
    });

    it("writes partial chunks as SSE events", async () => {
      const res = makeMockRes();
      const req = makeMockReq();

      await service.sendMessage(
        { widgetKey: "wk_test", threadId: "thread-uuid-1", text: "Вопрос" },
        req as any,
        res as any
      );

      expect(res.write).toHaveBeenCalledWith("event: partial\ndata: Кровля \n\n");
      expect(res.write).toHaveBeenCalledWith("event: partial\ndata: стоит 500$\n\n");
    });

    it("saves incoming message before calling engine", async () => {
      const callOrder: string[] = [];
      threadService.saveMessage.mockImplementation(async (_id, _text, dir) => {
        callOrder.push("save:" + dir);
      });
      graphService.streamAnswer.mockImplementation(async (_p, onPartial) => {
        callOrder.push("engine");
        onPartial("chunk");
        return mockResult;
      });

      const res = makeMockRes();
      const req = makeMockReq();
      await service.sendMessage(
        { widgetKey: "wk_test", threadId: "thread-uuid-1", text: "Вопрос" },
        req as any,
        res as any
      );

      expect(callOrder[0]).toBe("save:" + MessageDirection.INCOMING);
      expect(callOrder[1]).toBe("engine");
    });

    it("saves outgoing message after streaming completes", async () => {
      const res = makeMockRes();
      const req = makeMockReq();

      await service.sendMessage(
        { widgetKey: "wk_test", threadId: "thread-uuid-1", text: "Вопрос" },
        req as any,
        res as any
      );

      expect(threadService.saveMessage).toHaveBeenCalledWith(
        "thread-uuid-1",
        "Кровля стоит 500$",
        MessageDirection.OUTGOING
      );
    });

    it("always writes event: final", async () => {
      const res = makeMockRes();
      const req = makeMockReq();

      await service.sendMessage(
        { widgetKey: "wk_test", threadId: "thread-uuid-1", text: "Вопрос" },
        req as any,
        res as any
      );

      const finalCall = (res.write as jest.Mock).mock.calls.find(([arg]: [string]) =>
        arg.startsWith("event: final")
      );
      expect(finalCall).toBeDefined();
    });

    it("always calls res.end()", async () => {
      const res = makeMockRes();
      const req = makeMockReq();

      await service.sendMessage(
        { widgetKey: "wk_test", threadId: "thread-uuid-1", text: "Вопрос" },
        req as any,
        res as any
      );

      expect(res.end).toHaveBeenCalled();
    });

    it("writes event: error when engine throws", async () => {
      graphService.streamAnswer.mockRejectedValue(new Error("engine failure"));

      const res = makeMockRes();
      const req = makeMockReq();

      await service.sendMessage(
        { widgetKey: "wk_test", threadId: "thread-uuid-1", text: "Вопрос" },
        req as any,
        res as any
      );

      expect(res.write).toHaveBeenCalledWith("event: error\ndata: engine failure\n\n");
      expect(res.end).toHaveBeenCalled();
    });
  });
});
