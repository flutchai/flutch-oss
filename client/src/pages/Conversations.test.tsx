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

vi.mock("@/api/conversations", () => ({
  conversationsApi: { list: vi.fn() },
}));

const { ConversationsPage } = await import("./Conversations");

const mockThreadsData = {
  data: [
    {
      id: "thread-uuid-12345678",
      agentId: "agent-1",
      platform: "telegram",
      userId: "user-1",
      messageCount: 5,
      createdAt: "2024-01-15T10:00:00Z",
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
};

describe("ConversationsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    render(<ConversationsPage />);

    expect(screen.getByTestId("conversations-loading")).toBeInTheDocument();
  });

  it("renders page heading", () => {
    mockUseQuery.mockReturnValue({ data: mockThreadsData, isLoading: false });

    render(<ConversationsPage />);

    expect(screen.getByTestId("conversations-heading")).toBeInTheDocument();
  });

  it("shows total conversation count", () => {
    mockUseQuery.mockReturnValue({ data: mockThreadsData, isLoading: false });

    render(<ConversationsPage />);

    expect(screen.getByTestId("conversations-total")).toHaveTextContent("1 conversations");
  });

  it("renders thread data in table", () => {
    mockUseQuery.mockReturnValue({ data: mockThreadsData, isLoading: false });

    render(<ConversationsPage />);

    // Thread ID is sliced to first 8 chars + ellipsis char — use toHaveTextContent for robustness
    expect(screen.getAllByTestId("thread-id")[0]).toHaveTextContent("thread-u");
    expect(screen.getAllByTestId("thread-agent")[0]).toHaveTextContent("agent-1");
    expect(screen.getAllByTestId("thread-messages")[0]).toHaveTextContent("5");
  });

  it("renders platform filter buttons", () => {
    mockUseQuery.mockReturnValue({ data: mockThreadsData, isLoading: false });

    render(<ConversationsPage />);

    expect(screen.getByTestId("filter-all")).toBeInTheDocument();
    expect(screen.getByTestId("filter-telegram")).toBeInTheDocument();
    expect(screen.getByTestId("filter-widget")).toBeInTheDocument();
    expect(screen.getByTestId("filter-api")).toBeInTheDocument();
  });

  it("shows empty state when no conversations", () => {
    mockUseQuery.mockReturnValue({
      data: { data: [], total: 0, page: 1, limit: 20 },
      isLoading: false,
    });

    render(<ConversationsPage />);

    expect(screen.getByTestId("conversations-empty")).toBeInTheDocument();
  });

  it("shows pagination info when multiple pages", () => {
    mockUseQuery.mockReturnValue({
      data: { data: mockThreadsData.data, total: 60, page: 1, limit: 20 },
      isLoading: false,
    });

    render(<ConversationsPage />);

    expect(screen.getByTestId("pagination-info")).toHaveTextContent("Page 1 of 3");
  });

  it("hides pagination info on single page", () => {
    mockUseQuery.mockReturnValue({ data: mockThreadsData, isLoading: false });

    render(<ConversationsPage />);

    expect(screen.queryByTestId("pagination-info")).not.toBeInTheDocument();
  });
});
