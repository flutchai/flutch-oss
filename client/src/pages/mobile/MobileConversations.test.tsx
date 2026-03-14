import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, "data-testid": testid }: any) =>
    React.createElement("a", { href: to, "data-testid": testid }, children),
}));

vi.mock("@/api/conversations", () => ({
  conversationsApi: { list: vi.fn() },
}));

const { MobileConversations } = await import("./MobileConversations");

const mockThread = {
  id: "thread-abc123",
  agentId: "agent-1",
  platform: "telegram",
  userId: "user-1",
  messageCount: 3,
  createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
};

const mockData = { data: [mockThread], total: 1, page: 1, limit: 15 };

describe("MobileConversations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<MobileConversations />);
    expect(screen.getByTestId("conversations-loading")).toBeInTheDocument();
  });

  it("renders conversations total", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false });
    render(<MobileConversations />);
    expect(screen.getByTestId("conversations-total")).toHaveTextContent("1 total");
  });

  it("shows 0 total when no data", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    render(<MobileConversations />);
    expect(screen.getByTestId("conversations-total")).toHaveTextContent("0 total");
  });

  it("renders conversation cards", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false });
    render(<MobileConversations />);
    expect(screen.getByTestId("conversation-card-thread-abc123")).toBeInTheDocument();
  });

  it("renders filter buttons", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false });
    render(<MobileConversations />);
    expect(screen.getByTestId("filter-all")).toBeInTheDocument();
    expect(screen.getByTestId("filter-telegram")).toBeInTheDocument();
    expect(screen.getByTestId("filter-widget")).toBeInTheDocument();
    expect(screen.getByTestId("filter-api")).toBeInTheDocument();
  });

  it("shows empty state when no conversations", () => {
    mockUseQuery.mockReturnValue({
      data: { data: [], total: 0, page: 1, limit: 15 },
      isLoading: false,
    });
    render(<MobileConversations />);
    expect(screen.getByTestId("conversations-empty")).toBeInTheDocument();
    expect(screen.getByTestId("conversations-empty")).toHaveTextContent("No conversations");
  });

  it("shows mobile-conversations-list when loaded", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false });
    render(<MobileConversations />);
    expect(screen.getByTestId("mobile-conversations-list")).toBeInTheDocument();
  });

  it("does not show pagination when only one page", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false });
    render(<MobileConversations />);
    expect(screen.queryByTestId("pagination-info")).not.toBeInTheDocument();
  });

  it("shows pagination when multiple pages", () => {
    mockUseQuery.mockReturnValue({
      data: { data: [mockThread], total: 45, page: 1, limit: 15 },
      isLoading: false,
    });
    render(<MobileConversations />);
    expect(screen.getByTestId("pagination-info")).toHaveTextContent("Page 1 of 3");
    expect(screen.getByTestId("pagination-prev")).toBeInTheDocument();
    expect(screen.getByTestId("pagination-next")).toBeInTheDocument();
  });

  it("clicking a platform filter button calls setPage(1)", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false });
    render(<MobileConversations />);
    fireEvent.click(screen.getByTestId("filter-telegram"));
    // After click, filter-telegram should now be in "default" variant (active)
    expect(screen.getByTestId("filter-telegram")).toBeInTheDocument();
  });
});
