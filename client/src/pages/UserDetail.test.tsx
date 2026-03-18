import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) =>
    React.createElement("a", { href: to, ...props }, children),
  useParams: vi.fn(() => ({ id: "user-uuid-1" })),
}));

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("@/api/users", () => ({
  usersApi: { getUser: vi.fn(), mergeUsers: vi.fn() },
}));

const { UserDetailPage } = await import("./UserDetail");

const mockUser = {
  id: "user-uuid-1",
  identities: [
    {
      platform: "telegram",
      externalId: "12345",
      metadata: { username: "ivan", first_name: "Ivan" },
    },
  ],
  threads: [
    { id: "thread-1", agentId: "agent-1", platform: "telegram", createdAt: "2024-01-15T10:00:00Z" },
  ],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-02T00:00:00Z",
};

describe("UserDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    });
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    render(<UserDetailPage />);

    expect(screen.getByTestId("user-loading")).toBeInTheDocument();
  });

  it("shows not-found state when user is null", () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });

    render(<UserDetailPage />);

    expect(screen.getByTestId("user-not-found")).toBeInTheDocument();
  });

  it("renders user id", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });

    render(<UserDetailPage />);

    expect(screen.getByTestId("user-id")).toHaveTextContent("user-uuid-1");
  });

  it("renders identity details", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });

    render(<UserDetailPage />);

    expect(screen.getAllByTestId("identity-external-id")[0]).toHaveTextContent("12345");
    expect(screen.getAllByTestId("identity-username")[0]).toHaveTextContent("@ivan");
    expect(screen.getAllByTestId("identity-first-name")[0]).toHaveTextContent("Ivan");
  });

  it("renders telegram badges for identity and thread — multiple allowed", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });

    render(<UserDetailPage />);

    // "telegram" appears in both identity badge and thread badge
    const telegramItems = screen.getAllByTestId("identity-platform");
    expect(telegramItems.length).toBeGreaterThanOrEqual(1);
    expect(telegramItems[0]).toHaveTextContent("telegram");
  });

  it("renders thread link with agent id", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });

    render(<UserDetailPage />);

    expect(screen.getAllByTestId("thread-link")[0]).toHaveTextContent("agent-1");
  });

  it("shows empty identities message when none", () => {
    mockUseQuery.mockReturnValue({
      data: { ...mockUser, identities: [] },
      isLoading: false,
    });

    render(<UserDetailPage />);

    expect(screen.getByTestId("identities-empty")).toBeInTheDocument();
  });

  it("shows empty threads message when none", () => {
    mockUseQuery.mockReturnValue({
      data: { ...mockUser, threads: [] },
      isLoading: false,
    });

    render(<UserDetailPage />);

    expect(screen.getByTestId("conversations-empty")).toBeInTheDocument();
  });

  it("shows merge UI when Merge button is clicked", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });

    render(<UserDetailPage />);
    fireEvent.click(screen.getByTestId("merge-toggle-button"));

    expect(screen.getByTestId("merge-title")).toBeInTheDocument();
  });

  it("merge submit button is disabled when target ID is empty", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });

    render(<UserDetailPage />);
    fireEvent.click(screen.getByTestId("merge-toggle-button"));

    expect(screen.getByTestId("merge-submit-button")).toBeDisabled();
  });
});
