import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("./client", () => ({
  apiClient: { get: mockGet, post: mockPost },
}));

const { dashboardApi } = await import("./dashboard");

const mockStats = {
  agents_count: 2,
  threads_today: 5,
  messages_today: 20,
  users_total: 100,
  total_threads: 500,
};

const mockStatus = { engine: true, database: true, ragflow: false };
const mockActivity = [
  { id: "m-1", threadId: "t-1", agentId: "a-1", platform: "telegram", preview: "Hi", createdAt: "2024-01-01" },
];

describe("dashboardApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getStats calls GET /dashboard/stats", async () => {
    mockGet.mockResolvedValue({ data: mockStats });

    const result = await dashboardApi.getStats();

    expect(mockGet).toHaveBeenCalledWith("/dashboard/stats");
    expect(result).toEqual(mockStats);
  });

  it("getStats returns null agents_count in platform mode", async () => {
    mockGet.mockResolvedValue({ data: { ...mockStats, agents_count: null } });

    const result = await dashboardApi.getStats();

    expect(result.agents_count).toBeNull();
  });

  it("getStatus calls GET /dashboard/status", async () => {
    mockGet.mockResolvedValue({ data: mockStatus });

    const result = await dashboardApi.getStatus();

    expect(mockGet).toHaveBeenCalledWith("/dashboard/status");
    expect(result).toEqual(mockStatus);
  });

  it("getActivity calls GET /dashboard/activity", async () => {
    mockGet.mockResolvedValue({ data: mockActivity });

    const result = await dashboardApi.getActivity();

    expect(mockGet).toHaveBeenCalledWith("/dashboard/activity");
    expect(result).toEqual(mockActivity);
  });
});
