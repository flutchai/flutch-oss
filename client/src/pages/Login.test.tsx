import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const mockNavigate = vi.fn();
const mockLogin = vi.fn();
const mockMutate = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (...args: any[]) => mockUseMutation(...args),
}));

vi.mock("@/api/auth", () => ({
  authApi: { login: vi.fn() },
}));

vi.mock("@/store/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({ token: null, mustChangePassword: false, login: mockLogin }),
}));

const { LoginPage } = await import("./Login");

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
    });
  });

  it("renders login form with username and password fields", () => {
    render(<LoginPage />);

    expect(screen.getByTestId("login-username-input")).toBeInTheDocument();
    expect(screen.getByTestId("login-password-input")).toBeInTheDocument();
    expect(screen.getByTestId("login-submit-button")).toBeInTheDocument();
  });

  it("renders brand name", () => {
    render(<LoginPage />);

    const title = screen.getByTestId("login-brand-title");
    const subtitle = screen.getByTestId("login-brand-subtitle");
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Flutch OSS");
    expect(subtitle).toBeInTheDocument();
    expect(subtitle).toHaveTextContent("Admin Panel");
  });

  it("shows validation errors when submitting empty form", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByTestId("login-submit-button"));

    await waitFor(() => {
      expect(screen.getByTestId("login-username-error")).toBeInTheDocument();
      expect(screen.getByTestId("login-password-error")).toBeInTheDocument();
    });
  });

  it("shows error message when mutation has error", () => {
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
    });

    render(<LoginPage />);

    expect(screen.getByTestId("login-error")).toBeInTheDocument();
  });

  it("shows loading state while login is pending", () => {
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      isError: false,
    });

    render(<LoginPage />);

    expect(screen.getByTestId("login-submit-button")).toBeDisabled();
  });
});
