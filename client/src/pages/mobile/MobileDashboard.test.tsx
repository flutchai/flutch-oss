import { render, screen } from "@testing-library/react";
import React from "react";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, "data-testid": testid }: any) =>
    React.createElement("a", { href: to, "data-testid": testid }, children),
}));

vi.mock("@/api/dashboard", () => ({
  dashboardApi: {
    getStats: vi.fn(),
    getStatus: vi.fn(),
    getActivity: vi.fn(),
  },
}));

const { MobileDashboard } = await import("./MobileDashboard");

const mockStats = {
  agents_count: 2,
  threads_today: 7,
  messages_today: 30,
  users_total: 50,
  total_threads: 200,
};

const mockStatus = { engine: true, database: true, ragflow: false };

const mockActivity = [
  {
    id: "act-1",
    threadId: "thread-1",
    agentId: "agent-1",
    platform: "telegram",
    preview: "Hello world",
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
];

const makeQueryMock =
  (statsData: any, statusData: any, activityData: any) =>
  (opts: any) => {
    const key = opts?.queryKey?.[1];
    if (key === "stats") return { data: statsData, isLoading: false };
    if (key === "status") return { data: statusData, isLoading: false };
    if (key === "activity") return { data: activityData, isLoading: false };
    return { data: undefined, isLoading: false };
  };

describe("MobileDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockImplementation(makeQueryMock(mockStats, mockStatus, mockActivity));
  });

  it("renders the mobile-dashboard container", () => {
    render(<MobileDashboard />);
    expect(screen.getByTestId("mobile-dashboard")).toBeInTheDocument();
  });

  it("renders stat values", () => {
    render(<MobileDashboard />);
    expect(screen.getByTestId("stat-agents-count")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-threads-today")).toHaveTextContent("7");
    expect(screen.getByTestId("stat-messages-today")).toHaveTextContent("30");
    expect(screen.getByTestId("stat-users-total")).toHaveTextContent("50");
  });

  it("shows — for agents_count when null", () => {
    mockUseQuery.mockImplementation(
      makeQueryMock({ ...mockStats, agents_count: null }, mockStatus, mockActivity)
    );
    render(<MobileDashboard />);
    expect(screen.getByTestId("stat-agents-count")).toHaveTextContent("—");
  });

  it("renders status items for engine, database, ragflow", () => {
    render(<MobileDashboard />);
    expect(screen.getByTestId("status-engine")).toBeInTheDocument();
    expect(screen.getByTestId("status-database")).toBeInTheDocument();
    expect(screen.getByTestId("status-ragflow")).toBeInTheDocument();
  });

  it("shows Online/Offline in status items", () => {
    render(<MobileDashboard />);
    expect(screen.getByTestId("status-engine")).toHaveTextContent("Online");
    expect(screen.getByTestId("status-database")).toHaveTextContent("Online");
    expect(screen.getByTestId("status-ragflow")).toHaveTextContent("Offline");
  });

  it("renders activity list when data is present", () => {
    render(<MobileDashboard />);
    expect(screen.getByTestId("activity-list")).toBeInTheDocument();
    expect(screen.getByTestId("activity-item-act-1")).toBeInTheDocument();
  });

  it("shows activity-empty when no activity", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockStats, mockStatus, []));
    render(<MobileDashboard />);
    expect(screen.getByTestId("activity-empty")).toBeInTheDocument();
    expect(screen.getByTestId("activity-empty")).toHaveTextContent("No activity");
  });

  it("shows activity-loading when activity is loading", () => {
    mockUseQuery.mockImplementation((opts: any) => {
      const key = opts?.queryKey?.[1];
      if (key === "stats") return { data: mockStats, isLoading: false };
      if (key === "status") return { data: mockStatus, isLoading: false };
      if (key === "activity") return { data: undefined, isLoading: true };
      return { data: undefined, isLoading: false };
    });
    render(<MobileDashboard />);
    expect(screen.getByTestId("activity-loading")).toBeInTheDocument();
    expect(screen.getByTestId("activity-loading")).toHaveTextContent("Loading...");
  });

  it("shows — for stats when no stats data", () => {
    mockUseQuery.mockImplementation(makeQueryMock(undefined, mockStatus, []));
    render(<MobileDashboard />);
    const counts = screen.getAllByText("—");
    expect(counts.length).toBeGreaterThan(0);
  });
});
