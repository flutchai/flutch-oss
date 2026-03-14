import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseQueryClient = vi.fn(() => ({ invalidateQueries: vi.fn() }));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient(),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ id: "user-abc-123" }),
  Link: ({ children, to, "data-testid": testid }: any) =>
    React.createElement("a", { href: to, "data-testid": testid }, children),
}));

vi.mock("@/api/users", () => ({
  usersApi: { getUser: vi.fn(), mergeUsers: vi.fn() },
}));

const { MobileUserDetail } = await import("./MobileUserDetail");

const mockUser = {
  id: "user-abc-123",
  createdAt: "2024-01-10T12:00:00Z",
  identities: [
    {
      platform: "telegram",
      externalId: "tg-999",
      metadata: { username: "alice", first_name: "Alice", last_name: "Smith" },
    },
  ],
  threads: [
    { id: "thread-001", platform: "telegram" },
  ],
};

describe("MobileUserDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
    });
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<MobileUserDetail />);
    expect(screen.getByTestId("user-loading")).toBeInTheDocument();
    expect(screen.getByTestId("user-loading")).toHaveTextContent("Loading...");
  });

  it("shows not-found state when no user data", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    render(<MobileUserDetail />);
    expect(screen.getByTestId("user-not-found")).toBeInTheDocument();
    expect(screen.getByTestId("user-not-found")).toHaveTextContent("User not found");
  });

  it("renders back button", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });
    render(<MobileUserDetail />);
    expect(screen.getByTestId("back-button")).toBeInTheDocument();
  });

  it("renders user id", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });
    render(<MobileUserDetail />);
    expect(screen.getByTestId("user-id")).toHaveTextContent("user-abc-123");
  });

  it("renders identity rows", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });
    render(<MobileUserDetail />);
    expect(screen.getByTestId("identity-row")).toBeInTheDocument();
    expect(screen.getByTestId("identity-platform")).toHaveTextContent("telegram");
    expect(screen.getByTestId("identity-external-id")).toHaveTextContent("@alice");
  });

  it("renders thread links", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });
    render(<MobileUserDetail />);
    expect(screen.getByTestId("thread-link")).toBeInTheDocument();
  });

  it("shows identities-empty when no identities", () => {
    mockUseQuery.mockReturnValue({
      data: { ...mockUser, identities: [] },
      isLoading: false,
    });
    render(<MobileUserDetail />);
    expect(screen.getByTestId("identities-empty")).toBeInTheDocument();
  });

  it("shows conversations-empty when no threads", () => {
    mockUseQuery.mockReturnValue({
      data: { ...mockUser, threads: [] },
      isLoading: false,
    });
    render(<MobileUserDetail />);
    expect(screen.getByTestId("conversations-empty")).toBeInTheDocument();
  });

  it("renders merge section with input and button", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });
    render(<MobileUserDetail />);
    expect(screen.getByTestId("merge-dialog-title")).toBeInTheDocument();
    expect(screen.getByTestId("merge-target-input")).toBeInTheDocument();
    expect(screen.getByTestId("merge-button")).toBeInTheDocument();
  });

  it("merge button is disabled when input is empty", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });
    render(<MobileUserDetail />);
    expect(screen.getByTestId("merge-button")).toBeDisabled();
  });

  it("merge button enables when target id is typed", () => {
    mockUseQuery.mockReturnValue({ data: mockUser, isLoading: false });
    render(<MobileUserDetail />);
    fireEvent.change(screen.getByTestId("merge-target-input"), {
      target: { value: "some-target-uuid" },
    });
    expect(screen.getByTestId("merge-button")).not.toBeDisabled();
  });
});
