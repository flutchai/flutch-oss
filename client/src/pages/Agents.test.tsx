import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import React from "react";

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@/api/agents", () => ({
  agentsApi: { list: vi.fn() },
}));

const { AgentsPage } = await import("./Agents");

const mockAgents = [
  {
    id: "agent-roofing",
    graphType: "v1.0.0",
    graphSettings: { model: "gpt-4o", systemPrompt: "You are a roofing assistant.", temperature: 0.7 },
    platforms: {
      telegram: { configured: true, botTokenMasked: "...xyz9" },
      widget: null,
    },
  },
];

describe("AgentsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    render(<AgentsPage />);

    expect(screen.getByTestId("agents-loading")).toBeInTheDocument();
    expect(screen.getByTestId("agents-loading")).toHaveTextContent("Loading...");
  });

  it("renders agent card when data is loaded", () => {
    mockUseQuery.mockReturnValue({ data: mockAgents, isLoading: false });

    render(<AgentsPage />);

    const card = screen.getByTestId("agent-card-agent-roofing");
    expect(card).toBeInTheDocument();
    expect(within(card).getByTestId("agent-id")).toHaveTextContent("agent-roofing");
    expect(within(card).getByTestId("agent-graph-type")).toHaveTextContent("v1.0.0");
    expect(within(card).getByTestId("agent-model")).toHaveTextContent("gpt-4o");
  });

  it("shows Telegram badge when telegram is configured", () => {
    mockUseQuery.mockReturnValue({ data: mockAgents, isLoading: false });

    render(<AgentsPage />);

    expect(screen.getByTestId("platform-badge-telegram")).toHaveTextContent("Telegram");
  });

  it("shows masked bot token", () => {
    mockUseQuery.mockReturnValue({ data: mockAgents, isLoading: false });

    render(<AgentsPage />);

    expect(screen.getByTestId("agent-bot-token")).toHaveTextContent("...xyz9");
  });

  it("shows system prompt when present", () => {
    mockUseQuery.mockReturnValue({ data: mockAgents, isLoading: false });

    render(<AgentsPage />);

    expect(screen.getByTestId("agent-system-prompt")).toHaveTextContent("You are a roofing assistant.");
  });

  it("shows empty state when no agents", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });

    render(<AgentsPage />);

    expect(screen.getByTestId("agents-empty")).toBeInTheDocument();
    expect(screen.getByTestId("agents-empty")).toHaveTextContent(/No agents/);
  });

  it("renders page heading", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });

    render(<AgentsPage />);

    expect(screen.getByTestId("agents-heading")).toBeInTheDocument();
    expect(screen.getByTestId("agents-heading")).toHaveTextContent("Agents");
  });
});
