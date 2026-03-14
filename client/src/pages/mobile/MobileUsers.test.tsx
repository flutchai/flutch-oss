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

vi.mock("@/api/users", () => ({
  usersApi: { list: vi.fn() },
}));

const { MobileUsers } = await import("./MobileUsers");

const mockUser = {
  id: "user-uuid-001",
  createdAt: "2024-02-01T10:00:00Z",
  identities: [
    {
      platform: "telegram",
      externalId: "tg-123",
      metadata: { username: "johndoe" },
    },
  ],
  threads: [],
};

const mockData = { data: [mockUser], total: 1, page: 1, limit: 15 };

describe("MobileUsers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<MobileUsers />);
    expect(screen.getByTestId("users-loading")).toBeInTheDocument();
  });

  it("renders users-total", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false });
    render(<MobileUsers />);
    expect(screen.getByTestId("users-total")).toHaveTextContent("1 total");
  });

  it("shows 0 total when no data", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    render(<MobileUsers />);
    expect(screen.getByTestId("users-total")).toHaveTextContent("0 total");
  });

  it("renders user card", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false });
    render(<MobileUsers />);
    expect(screen.getByTestId("user-card-user-uuid-001")).toBeInTheDocument();
  });

  it("shows empty state when no users", () => {
    mockUseQuery.mockReturnValue({
      data: { data: [], total: 0, page: 1, limit: 15 },
      isLoading: false,
    });
    render(<MobileUsers />);
    expect(screen.getByTestId("users-empty")).toBeInTheDocument();
    expect(screen.getByTestId("users-empty")).toHaveTextContent("No users");
  });

  it("renders mobile-users-list when loaded", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false });
    render(<MobileUsers />);
    expect(screen.getByTestId("mobile-users-list")).toBeInTheDocument();
  });

  it("does not show pagination when single page", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false });
    render(<MobileUsers />);
    expect(screen.queryByTestId("pagination-info")).not.toBeInTheDocument();
  });

  it("shows pagination when multiple pages", () => {
    mockUseQuery.mockReturnValue({
      data: { data: [mockUser], total: 45, page: 1, limit: 15 },
      isLoading: false,
    });
    render(<MobileUsers />);
    expect(screen.getByTestId("pagination-info")).toHaveTextContent("Page 1 of 3");
    expect(screen.getByTestId("pagination-prev")).toBeInTheDocument();
    expect(screen.getByTestId("pagination-next")).toBeInTheDocument();
  });
});
