import { render, screen } from "@testing-library/react";
import React from "react";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@/api/agents", () => ({
  agentsApi: { list: vi.fn() },
}));

const { MobileAgents } = await import("./MobileAgents");

const mockAgents = [
  {
    id: "agent-alpha",
    graphType: "v1.0.0",
    graphSettings: { model: "gpt-4o", systemPrompt: "You are a helpful assistant" },
    platforms: {
      telegram: { configured: true, botTokenMasked: "...abc" },
      widget: { configured: false },
    },
  },
  {
    id: "agent-beta",
    graphType: "v1.0.0",
    graphSettings: { model: null, systemPrompt: null },
    platforms: {
      telegram: { configured: false },
      widget: { configured: true },
    },
  },
];

describe("MobileAgents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<MobileAgents />);
    expect(screen.getByTestId("agents-loading")).toBeInTheDocument();
    expect(screen.getByTestId("agents-loading")).toHaveTextContent("Loading...");
  });

  it("shows empty state when agents list is empty", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<MobileAgents />);
    expect(screen.getByTestId("agents-empty-state")).toBeInTheDocument();
  });

  it("renders agents list when data is present", () => {
    mockUseQuery.mockReturnValue({ data: mockAgents, isLoading: false });
    render(<MobileAgents />);
    expect(screen.getByTestId("agents-list")).toBeInTheDocument();
  });

  it("renders agent cards with correct ids", () => {
    mockUseQuery.mockReturnValue({ data: mockAgents, isLoading: false });
    render(<MobileAgents />);
    expect(screen.getByTestId("agent-card-agent-alpha")).toBeInTheDocument();
    expect(screen.getByTestId("agent-card-agent-beta")).toBeInTheDocument();
  });

  it("renders agent id and graph type", () => {
    mockUseQuery.mockReturnValue({ data: [mockAgents[0]], isLoading: false });
    render(<MobileAgents />);
    expect(screen.getByTestId("agent-id")).toHaveTextContent("agent-alpha");
    expect(screen.getByTestId("agent-graph-type")).toHaveTextContent("v1.0.0");
  });

  it("renders agent model", () => {
    mockUseQuery.mockReturnValue({ data: [mockAgents[0]], isLoading: false });
    render(<MobileAgents />);
    expect(screen.getByTestId("agent-model")).toHaveTextContent("gpt-4o");
  });

  it("shows — for model when null", () => {
    mockUseQuery.mockReturnValue({ data: [mockAgents[1]], isLoading: false });
    render(<MobileAgents />);
    expect(screen.getByTestId("agent-model")).toHaveTextContent("—");
  });

  it("shows telegram platform badge when telegram configured", () => {
    mockUseQuery.mockReturnValue({ data: [mockAgents[0]], isLoading: false });
    render(<MobileAgents />);
    expect(screen.getByTestId("platform-badge-telegram")).toBeInTheDocument();
    expect(screen.getByTestId("platform-badge-telegram")).toHaveTextContent("Telegram");
  });

  it("shows widget platform badge when widget configured", () => {
    mockUseQuery.mockReturnValue({ data: [mockAgents[1]], isLoading: false });
    render(<MobileAgents />);
    expect(screen.getByTestId("platform-badge-widget")).toBeInTheDocument();
    expect(screen.getByTestId("platform-badge-widget")).toHaveTextContent("Widget");
  });

  it("shows system prompt when present", () => {
    mockUseQuery.mockReturnValue({ data: [mockAgents[0]], isLoading: false });
    render(<MobileAgents />);
    expect(screen.getByTestId("agent-system-prompt")).toHaveTextContent("You are a helpful assistant");
  });

  it("does not show system prompt when absent", () => {
    mockUseQuery.mockReturnValue({ data: [mockAgents[1]], isLoading: false });
    render(<MobileAgents />);
    expect(screen.queryByTestId("agent-system-prompt")).not.toBeInTheDocument();
  });
});
