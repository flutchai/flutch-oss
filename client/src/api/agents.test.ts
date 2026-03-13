import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("./client", () => ({
  apiClient: { get: mockGet, post: mockPost },
}));

const { agentsApi } = await import("./agents");

const mockAgents = [
  {
    id: "agent-1",
    graphType: "v1.0.0",
    graphSettings: { model: "gpt-4o", systemPrompt: "Be helpful.", temperature: 0.7 },
    platforms: {
      telegram: { configured: true, botTokenMasked: "...abcd" },
      widget: null,
    },
  },
];

describe("agentsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list calls GET /agents", async () => {
    mockGet.mockResolvedValue({ data: mockAgents });

    const result = await agentsApi.list();

    expect(mockGet).toHaveBeenCalledWith("/agents");
    expect(result).toEqual(mockAgents);
  });

  it("list returns empty array when no agents", async () => {
    mockGet.mockResolvedValue({ data: [] });

    const result = await agentsApi.list();

    expect(result).toEqual([]);
  });
});
