import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: any) => React.createElement("a", { href: to }, children),
}));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@/api/users", () => ({
  usersApi: { list: vi.fn() },
}));

const { UsersPage } = await import("./Users");

const mockUsersData = {
  data: [
    {
      id: "user-uuid-12345678",
      identities: [{ platform: "telegram", externalId: "99999", metadata: { username: "ivan" } }],
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-16T10:00:00Z",
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
};

describe("UsersPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    render(<UsersPage />);

    expect(screen.getByTestId("users-loading")).toBeInTheDocument();
  });

  it("renders page heading", () => {
    mockUseQuery.mockReturnValue({ data: mockUsersData, isLoading: false });

    render(<UsersPage />);

    expect(screen.getByTestId("users-heading")).toBeInTheDocument();
  });

  it("shows total user count", () => {
    mockUseQuery.mockReturnValue({ data: mockUsersData, isLoading: false });

    render(<UsersPage />);

    expect(screen.getByTestId("users-total")).toHaveTextContent("1 users");
  });

  it("renders truncated user ID in table", () => {
    mockUseQuery.mockReturnValue({ data: mockUsersData, isLoading: false });

    render(<UsersPage />);

    expect(screen.getAllByTestId("user-id")[0]).toHaveTextContent("user-uui");
  });

  it("renders identity badges", () => {
    mockUseQuery.mockReturnValue({ data: mockUsersData, isLoading: false });

    render(<UsersPage />);

    expect(screen.getAllByTestId("identity-badge")[0]).toHaveTextContent("telegram: 99999");
  });

  it("renders username in badge when available", () => {
    mockUseQuery.mockReturnValue({ data: mockUsersData, isLoading: false });

    render(<UsersPage />);

    const badges = screen.getAllByTestId("identity-badge");
    expect(badges[0]).toHaveTextContent("@ivan");
  });

  it("shows empty state when no users", () => {
    mockUseQuery.mockReturnValue({
      data: { data: [], total: 0, page: 1, limit: 20 },
      isLoading: false,
    });

    render(<UsersPage />);

    expect(screen.getByTestId("users-empty")).toBeInTheDocument();
  });

  it("shows pagination when multiple pages", () => {
    mockUseQuery.mockReturnValue({
      data: { data: mockUsersData.data, total: 50, page: 1, limit: 20 },
      isLoading: false,
    });

    render(<UsersPage />);

    expect(screen.getByTestId("pagination-info")).toHaveTextContent("Page 1 of 3");
  });

  it("does not show pagination for a single page", () => {
    mockUseQuery.mockReturnValue({ data: mockUsersData, isLoading: false });

    render(<UsersPage />);

    expect(screen.queryByTestId("pagination-info")).not.toBeInTheDocument();
  });
});
