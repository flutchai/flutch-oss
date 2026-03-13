import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { AdminSettingsService } from "./admin-settings.service";
import { AgentConfigService } from "../../config/agent-config.service";
import { of, throwError } from "rxjs";
import { AxiosResponse } from "axios";

describe("AdminSettingsService", () => {
  let service: AdminSettingsService;
  let configService: { get: jest.Mock };
  let httpService: { post: jest.Mock };
  let agentConfigService: { getConfig: jest.Mock };

  beforeEach(async () => {
    configService = { get: jest.fn() };
    httpService = { post: jest.fn() };
    agentConfigService = { getConfig: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSettingsService,
        { provide: ConfigService, useValue: configService },
        { provide: HttpService, useValue: httpService },
        { provide: AgentConfigService, useValue: agentConfigService },
      ],
    }).compile();

    service = module.get<AdminSettingsService>(AdminSettingsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("getSettings", () => {
    it("masks last 4 chars of API keys", () => {
      configService.get.mockImplementation((key: string) => {
        if (key === "OPENAI_API_KEY") return "sk-openai-full-key-abcd";
        if (key === "ANTHROPIC_API_KEY") return "sk-ant-full-key-efgh";
        if (key === "FLUTCH_PLATFORM_URL") return "https://api.flutch.ai";
        if (key === "CONFIG_MODE") return "local";
        return "";
      });

      const result = service.getSettings();

      expect(result.openaiKeyMasked).toBe("sk-...abcd");
      expect(result.anthropicKeyMasked).toBe("sk-ant-...efgh");
    });

    it("returns null for missing API keys", () => {
      configService.get.mockReturnValue("");

      const result = service.getSettings();

      expect(result.openaiKeyMasked).toBeNull();
      expect(result.anthropicKeyMasked).toBeNull();
    });

    it("masks platform URL to host only", () => {
      configService.get.mockImplementation((key: string) => {
        if (key === "FLUTCH_PLATFORM_URL") return "https://api.flutch.ai/some/path?token=secret";
        return "";
      });

      const result = service.getSettings();

      expect(result.flutchPlatformUrl).toBe("https://api.flutch.ai");
    });

    it("returns null for flutchPlatformUrl when not configured", () => {
      configService.get.mockReturnValue("");

      const result = service.getSettings();

      expect(result.flutchPlatformUrl).toBeNull();
    });
  });

  describe("registerWebhook", () => {
    it("returns error when agent has no telegram bot token", async () => {
      agentConfigService.getConfig.mockResolvedValue({ platforms: {} });

      const result = await service.registerWebhook("agent-1");

      expect(result).toEqual({
        success: false,
        error: "No Telegram bot token configured for this agent",
      });
    });

    it("returns error when WEBHOOK_BASE_URL is not set", async () => {
      agentConfigService.getConfig.mockResolvedValue({
        platforms: { telegram: { botToken: "bot-token-123" } },
      });
      configService.get.mockReturnValue("");

      const result = await service.registerWebhook("agent-1");

      expect(result).toEqual({ success: false, error: "WEBHOOK_BASE_URL env variable not set" });
    });

    it("registers webhook and returns success when all configured", async () => {
      agentConfigService.getConfig.mockResolvedValue({
        platforms: { telegram: { botToken: "bot-token-123" } },
      });
      configService.get.mockReturnValue("https://my-server.com");
      httpService.post.mockReturnValue(
        of({ data: { ok: true, description: "Webhook was set" } } as unknown as AxiosResponse)
      );

      const result = await service.registerWebhook("agent-1");

      expect(result.success).toBe(true);
      expect(result.webhookUrl).toBe("https://my-server.com/public/tg/webhook/agent-1");
      expect(httpService.post).toHaveBeenCalledWith(
        "https://api.telegram.org/botbot-token-123/setWebhook",
        { url: "https://my-server.com/public/tg/webhook/agent-1" }
      );
    });

    it("returns error when Telegram API call fails", async () => {
      agentConfigService.getConfig.mockResolvedValue({
        platforms: { telegram: { botToken: "bot-token-123" } },
      });
      configService.get.mockReturnValue("https://my-server.com");
      httpService.post.mockReturnValue(throwError(() => new Error("network error")));

      const result = await service.registerWebhook("agent-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("network error");
    });
  });
});
