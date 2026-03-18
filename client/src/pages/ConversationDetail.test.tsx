import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: any) => React.createElement("a", { href: to }, children),
  useParams: vi.fn(() => ({ id: "thread-uuid-1" })),
}));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@/api/conversations", () => ({
  conversationsApi: { getThread: vi.fn() },
}));

const { ConversationDetailPage } = await import("./ConversationDetail");

const mockThread = {
  id: "thread-uuid-1",
  agentId: "agent-roofing",
  platform: "telegram",
  user: {
    id: "user-uuid-1",
    identities: [{ platform: "telegram", externalId: "12345", metadata: { username: "ivan" } }],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
  createdAt: "2024-01-15T10:00:00Z",
  messages: [
    {
      id: "msg-1",
      content: "Сколько стоит крыша?",
      direction: "incoming",
      createdAt: "2024-01-15T10:01:00Z",
    },
    {
      id: "msg-2",
      content: "Зависит от площади.",
      direction: "outgoing",
      createdAt: "2024-01-15T10:02:00Z",
    },
  ],
};

describe("ConversationDetailPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    render(<ConversationDetailPage />);

    expect(screen.getByTestId("conversation-loading")).toBeInTheDocument();
  });

  it("shows not-found state when thread is null", () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });

    render(<ConversationDetailPage />);

    expect(screen.getByTestId("conversation-not-found")).toBeInTheDocument();
  });

  it("renders thread agent id", () => {
    mockUseQuery.mockReturnValue({ data: mockThread, isLoading: false });

    render(<ConversationDetailPage />);

    expect(screen.getByTestId("thread-agent-id")).toHaveTextContent("agent-roofing");
  });

  it("renders platform badge — multiple telegram elements expected", () => {
    mockUseQuery.mockReturnValue({ data: mockThread, isLoading: false });

    render(<ConversationDetailPage />);

    // "telegram" appears in both the header platform badge and the identity badge
    const badges = screen.getAllByTestId("platform-badge");
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it("renders user identity info", () => {
    mockUseQuery.mockReturnValue({ data: mockThread, isLoading: false });

    render(<ConversationDetailPage />);

    expect(screen.getByTestId("identity-external-id")).toHaveTextContent("12345");
    expect(screen.getByTestId("identity-username")).toHaveTextContent("@ivan");
  });

  it("renders all messages", () => {
    mockUseQuery.mockReturnValue({ data: mockThread, isLoading: false });

    render(<ConversationDetailPage />);

    expect(screen.getAllByTestId("message-incoming")[0]).toHaveTextContent("Сколько стоит крыша?");
    expect(screen.getAllByTestId("message-outgoing")[0]).toHaveTextContent("Зависит от площади.");
  });

  it("shows empty messages state", () => {
    mockUseQuery.mockReturnValue({
      data: { ...mockThread, messages: [] },
      isLoading: false,
    });

    render(<ConversationDetailPage />);

    expect(screen.getByTestId("messages-empty")).toBeInTheDocument();
  });

  it("renders back button link", () => {
    mockUseQuery.mockReturnValue({ data: mockThread, isLoading: false });

    render(<ConversationDetailPage />);

    expect(screen.getByTestId("back-button")).toBeInTheDocument();
  });
});
