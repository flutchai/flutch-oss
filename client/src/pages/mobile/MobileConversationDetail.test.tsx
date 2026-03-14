import { render, screen } from "@testing-library/react";
import React from "react";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ id: "thread-123" }),
  Link: ({ children, to, "data-testid": testid }: any) =>
    React.createElement("a", { href: to, "data-testid": testid }, children),
}));

vi.mock("@/api/conversations", () => ({
  conversationsApi: { getThread: vi.fn() },
}));

const { MobileConversationDetail } = await import("./MobileConversationDetail");

const mockThread = {
  id: "thread-123",
  agentId: "agent-1",
  platform: "telegram",
  user: { id: "user-42" },
  messages: [
    {
      id: "msg-1",
      direction: "incoming",
      content: "Hello there",
      createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    },
    {
      id: "msg-2",
      direction: "outgoing",
      content: "Hi! How can I help?",
      createdAt: new Date(Date.now() - 4 * 60000).toISOString(),
    },
  ],
};

describe("MobileConversationDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<MobileConversationDetail />);
    expect(screen.getByTestId("conversation-loading")).toBeInTheDocument();
    expect(screen.getByTestId("conversation-loading")).toHaveTextContent("Loading...");
  });

  it("shows not-found state when no thread data", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    render(<MobileConversationDetail />);
    expect(screen.getByTestId("conversation-not-found")).toBeInTheDocument();
    expect(screen.getByTestId("conversation-not-found")).toHaveTextContent("Conversation not found");
  });

  it("renders back button when thread loaded", () => {
    mockUseQuery.mockReturnValue({ data: mockThread, isLoading: false });
    render(<MobileConversationDetail />);
    expect(screen.getByTestId("back-button")).toBeInTheDocument();
  });

  it("renders thread agent id in header", () => {
    mockUseQuery.mockReturnValue({ data: mockThread, isLoading: false });
    render(<MobileConversationDetail />);
    expect(screen.getByTestId("thread-agent-id")).toHaveTextContent("agent-1");
  });

  it("renders platform badge", () => {
    mockUseQuery.mockReturnValue({ data: mockThread, isLoading: false });
    render(<MobileConversationDetail />);
    expect(screen.getByTestId("platform-badge")).toHaveTextContent("telegram");
  });

  it("renders incoming and outgoing messages", () => {
    mockUseQuery.mockReturnValue({ data: mockThread, isLoading: false });
    render(<MobileConversationDetail />);
    expect(screen.getByTestId("message-incoming")).toBeInTheDocument();
    expect(screen.getByTestId("message-outgoing")).toBeInTheDocument();
  });

  it("shows messages-empty when thread has no messages", () => {
    mockUseQuery.mockReturnValue({
      data: { ...mockThread, messages: [] },
      isLoading: false,
    });
    render(<MobileConversationDetail />);
    expect(screen.getByTestId("messages-empty")).toBeInTheDocument();
    expect(screen.getByTestId("messages-empty")).toHaveTextContent("No messages");
  });
});
