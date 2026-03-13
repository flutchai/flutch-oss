import { Test, TestingModule } from "@nestjs/testing";
import { AdminAgentsService } from "./admin-agents.service";
import { AgentConfigService } from "../../config/agent-config.service";

const makeConfig = (agentId: string, overrides: Record<string, any> = {}) => ({
  agentId,
  graphType: "v1.0.0",
  graphSettings: { model: "gpt-4o", systemPrompt: "You are helpful.", temperature: 0.7 },
  platforms: {},
  ...overrides,
});

describe("AdminAgentsService", () => {
  let service: AdminAgentsService;
  let agentConfigService: { getLocalConfigs: jest.Mock };

  beforeEach(async () => {
    agentConfigService = { getLocalConfigs: jest.fn().mockReturnValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAgentsService,
        { provide: AgentConfigService, useValue: agentConfigService },
      ],
    }).compile();

    service = module.get<AdminAgentsService>(AdminAgentsService);
  });

  afterEach(() => jest.clearAllMocks());

  it("returns empty array when no agents configured", () => {
    const result = service.getAgents();
    expect(result).toEqual([]);
  });

  it("returns mapped agent list", () => {
    agentConfigService.getLocalConfigs.mockReturnValue({ "agent-1": makeConfig("agent-1") });

    const result = service.getAgents();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "agent-1",
      graphType: "v1.0.0",
      graphSettings: { model: "gpt-4o", systemPrompt: "You are helpful.", temperature: 0.7 },
    });
  });

  it("masks telegram bot token (last 4 chars with ... prefix)", () => {
    agentConfigService.getLocalConfigs.mockReturnValue({
      "agent-tg": makeConfig("agent-tg", {
        platforms: { telegram: { botToken: "1234567890:ABCDEFGHIJ-long-token" } },
      }),
    });

    const result = service.getAgents();

    expect(result[0].platforms.telegram?.botTokenMasked).toMatch(/^\.\.\./);
    expect(result[0].platforms.telegram?.botTokenMasked).not.toContain("1234567890");
  });

  it("exposes widget key without masking", () => {
    agentConfigService.getLocalConfigs.mockReturnValue({
      "agent-w": makeConfig("agent-w", {
        platforms: { widget: { widgetKey: "wk-abc123" } },
      }),
    });

    const result = service.getAgents();

    expect(result[0].platforms.widget?.widgetKey).toBe("wk-abc123");
  });

  it("returns null for unconfigured platforms", () => {
    agentConfigService.getLocalConfigs.mockReturnValue({
      "agent-bare": makeConfig("agent-bare", { platforms: {} }),
    });

    const result = service.getAgents();

    expect(result[0].platforms.telegram).toBeNull();
    expect(result[0].platforms.widget).toBeNull();
  });
});
