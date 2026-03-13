import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("./client", () => ({
  apiClient: { get: mockGet, post: mockPost },
}));

const { settingsApi } = await import("./settings");

const mockSettings = {
  configMode: "local",
  flutchPlatformUrl: "https://api.flutch.ai",
  openaiKeyMasked: "sk-...abcd",
  anthropicKeyMasked: null,
};

describe("settingsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("get calls GET /settings", async () => {
    mockGet.mockResolvedValue({ data: mockSettings });

    const result = await settingsApi.get();

    expect(mockGet).toHaveBeenCalledWith("/settings");
    expect(result).toEqual(mockSettings);
  });

  it("registerWebhook calls POST /settings/telegram/webhook/:agentId", async () => {
    const webhookResult = {
      success: true,
      webhookUrl: "https://my-server.com/public/tg/webhook/agent-1",
      description: "Webhook was set",
    };
    mockPost.mockResolvedValue({ data: webhookResult });

    const result = await settingsApi.registerWebhook("agent-1");

    expect(mockPost).toHaveBeenCalledWith("/settings/telegram/webhook/agent-1");
    expect(result.success).toBe(true);
    expect(result.webhookUrl).toBe("https://my-server.com/public/tg/webhook/agent-1");
  });

  it("registerWebhook returns error result when webhook fails", async () => {
    mockPost.mockResolvedValue({
      data: { success: false, error: "No Telegram bot token configured for this agent" },
    });

    const result = await settingsApi.registerWebhook("agent-no-tg");

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
