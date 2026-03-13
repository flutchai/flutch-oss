import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("./client", () => ({
  apiClient: { get: mockGet, post: mockPost },
}));

const { conversationsApi } = await import("./conversations");

const mockThread = {
  id: "thread-1",
  agentId: "agent-1",
  platform: "telegram",
  userId: "user-1",
  messageCount: 5,
  createdAt: "2024-01-01",
};

const mockThreadDetail = {
  id: "thread-1",
  agentId: "agent-1",
  platform: "telegram",
  user: {
    id: "user-1",
    identities: [],
    createdAt: "2024-01-01",
    updatedAt: "2024-01-02",
  },
  createdAt: "2024-01-01",
  messages: [{ id: "msg-1", content: "Hi", direction: "incoming", createdAt: "2024-01-01" }],
};

describe("conversationsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list calls GET /conversations without params", async () => {
    mockGet.mockResolvedValue({
      data: { data: [mockThread], total: 1, page: 1, limit: 20 },
    });

    const result = await conversationsApi.list();

    expect(mockGet).toHaveBeenCalledWith("/conversations", { params: undefined });
    expect(result.data).toHaveLength(1);
  });

  it("list passes filter params", async () => {
    mockGet.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20 } });

    await conversationsApi.list({ agentId: "agent-1", platform: "telegram", page: 2, limit: 10 });

    expect(mockGet).toHaveBeenCalledWith("/conversations", {
      params: { agentId: "agent-1", platform: "telegram", page: 2, limit: 10 },
    });
  });

  it("getThread calls GET /conversations/:id", async () => {
    mockGet.mockResolvedValue({ data: mockThreadDetail });

    const result = await conversationsApi.getThread("thread-1");

    expect(mockGet).toHaveBeenCalledWith("/conversations/thread-1");
    expect(result.id).toBe("thread-1");
    expect(result.messages).toHaveLength(1);
    expect(result.user.updatedAt).toBe("2024-01-02");
  });
});
