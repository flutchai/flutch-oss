import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: any) => React.createElement("a", { href: to }, children),
}));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@/api/dashboard", () => ({
  dashboardApi: {
    getStats: vi.fn(),
    getStatus: vi.fn(),
    getActivity: vi.fn(),
  },
}));

const { DashboardPage } = await import("./Dashboard");

const mockStats = {
  agents_count: 3,
  threads_today: 12,
  messages_today: 45,
  users_total: 100,
  total_threads: 500,
};
const mockStatus = { engine: true, database: true, ragflow: false };
const mockActivity = [
  {
    id: "msg-1",
    threadId: "thread-1",
    agentId: "agent-1",
    platform: "telegram",
    preview: "Hello from user",
    createdAt: new Date().toISOString(),
  },
];

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery
      .mockReturnValueOnce({ data: mockStats, isLoading: false })
      .mockReturnValueOnce({ data: mockStatus, isLoading: false })
      .mockReturnValueOnce({ data: mockActivity, isLoading: false });
  });

  it("renders page heading", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("dashboard-heading")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-heading")).toHaveTextContent("Dashboard");
  });

  it("renders system status cards", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("status-card-engine")).toHaveTextContent("Engine");
    expect(screen.getByTestId("status-card-database")).toHaveTextContent("PostgreSQL");
    expect(screen.getByTestId("status-card-ragflow")).toHaveTextContent("RAGflow");
  });

  it("shows Online/Offline based on status data", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("status-card-engine-value")).toHaveTextContent("Online");
    expect(screen.getByTestId("status-card-database-value")).toHaveTextContent("Online");
    expect(screen.getByTestId("status-card-ragflow-value")).toHaveTextContent("Offline");
  });

  it("renders stats card values", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("stat-agents-count")).toHaveTextContent("3");
    expect(screen.getByTestId("stat-threads-today")).toHaveTextContent("12");
    expect(screen.getByTestId("stat-messages-today")).toHaveTextContent("45");
    expect(screen.getByTestId("stat-users-total")).toHaveTextContent("100");
  });

  it("shows — for agents_count when null (platform mode)", () => {
    mockUseQuery.mockReset();
    mockUseQuery
      .mockReturnValueOnce({ data: { ...mockStats, agents_count: null }, isLoading: false })
      .mockReturnValueOnce({ data: mockStatus, isLoading: false })
      .mockReturnValueOnce({ data: [], isLoading: false });

    render(<DashboardPage />);

    expect(screen.getByTestId("stat-agents-count")).toHaveTextContent("—");
  });

  it("renders activity items", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("activity-preview")).toHaveTextContent("Hello from user");
    expect(screen.getByTestId("activity-platform")).toHaveTextContent("telegram");
  });

  it("shows no activity message when list is empty", () => {
    mockUseQuery.mockReset();
    mockUseQuery
      .mockReturnValueOnce({ data: mockStats, isLoading: false })
      .mockReturnValueOnce({ data: mockStatus, isLoading: false })
      .mockReturnValueOnce({ data: [], isLoading: false });

    render(<DashboardPage />);

    expect(screen.getByTestId("activity-empty")).toBeInTheDocument();
    expect(screen.getByTestId("activity-empty")).toHaveTextContent("No activity");
  });

  it("shows loading text when activity is loading", () => {
    mockUseQuery.mockReset();
    mockUseQuery
      .mockReturnValueOnce({ data: undefined, isLoading: true })
      .mockReturnValueOnce({ data: undefined, isLoading: true })
      .mockReturnValueOnce({ data: undefined, isLoading: true });

    render(<DashboardPage />);

    expect(screen.getByTestId("activity-loading")).toBeInTheDocument();
    expect(screen.getByTestId("activity-loading")).toHaveTextContent("Loading...");
  });
});
