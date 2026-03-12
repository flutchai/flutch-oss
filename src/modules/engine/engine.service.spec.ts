import { Test, TestingModule } from "@nestjs/testing";
import { EngineService } from "./engine.service";
import { AgentConfigService } from "../config/agent-config.service";

const mockResolvedContext = {
  agentId: "my-agent",
  userId: "user-1",
  threadId: "my-agent:user-1",
  graphType: "flutch.agent",
  graphSettings: { model: "gpt-4o-mini", systemPrompt: "You are helpful." },
};

describe("EngineService", () => {
  let service: EngineService;
  let agentConfigService: jest.Mocked<AgentConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EngineService,
        {
          provide: AgentConfigService,
          useValue: {
            resolve: jest.fn().mockResolvedValue(mockResolvedContext),
          },
        },
      ],
    }).compile();

    service = module.get<EngineService>(EngineService);
    agentConfigService = module.get(AgentConfigService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should build payload with resolved context", async () => {
    const payload = await service.buildPayload({
      agentId: "my-agent",
      userId: "user-1",
      input: "hello",
    } as any);

    expect(payload.input).toEqual({
      messages: [expect.objectContaining({ content: "hello" })],
    });
    expect(payload.config.configurable.thread_id).toBe("my-agent:user-1");
    expect(payload.config.configurable.context.agentId).toBe("my-agent");
    expect(payload.config.configurable.context.userId).toBe("user-1");
    expect(payload.config.configurable.context.threadId).toBe("my-agent:user-1");
    expect(payload.config.configurable.graphSettings.model).toBe("gpt-4o-mini");
  });

  it("should generate a requestId when not provided", async () => {
    const payload = await service.buildPayload({
      agentId: "my-agent",
      userId: "user-1",
      input: "hi",
    } as any);

    expect(payload.requestId).toBeDefined();
    expect(typeof payload.requestId).toBe("string");
    expect(payload.requestId.length).toBeGreaterThan(0);
  });

  it("should use provided requestId", async () => {
    const payload = await service.buildPayload({
      agentId: "my-agent",
      userId: "user-1",
      input: "hi",
      requestId: "custom-req-id",
    } as any);

    expect(payload.requestId).toBe("custom-req-id");
  });

  it("should pass metadata when provided", async () => {
    const payload = await service.buildPayload({
      agentId: "my-agent",
      userId: "user-1",
      input: "hi",
      metadata: { source: "widget" },
    } as any);

    expect(payload.config.configurable.metadata).toEqual({ source: "widget" });
  });

  it("should default metadata to empty object when not provided", async () => {
    const payload = await service.buildPayload({
      agentId: "my-agent",
      userId: "user-1",
      input: "hi",
    } as any);

    expect(payload.config.configurable.metadata).toEqual({});
  });

  it("should call agentConfigService.resolve with correct args", async () => {
    await service.buildPayload({
      agentId: "my-agent",
      userId: "user-1",
      input: "hi",
    } as any);

    expect(agentConfigService.resolve).toHaveBeenCalledWith("my-agent", "user-1");
  });
});
