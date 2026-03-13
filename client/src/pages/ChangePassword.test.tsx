import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const mockNavigate = vi.fn();
const mockPasswordChanged = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (...args: any[]) => mockUseMutation(...args),
}));

vi.mock("@/api/auth", () => ({
  authApi: { changePassword: vi.fn() },
}));

vi.mock("@/store/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({ token: "jwt", mustChangePassword: true, passwordChanged: mockPasswordChanged }),
}));

const { ChangePasswordPage } = await import("./ChangePassword");

describe("ChangePasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    });
  });

  it("renders password change form", () => {
    render(<ChangePasswordPage />);

    expect(screen.getByTestId("change-password-heading")).toBeInTheDocument();
    expect(screen.getByTestId("current-password-label")).toBeInTheDocument();
    expect(screen.getByTestId("new-password-label")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-password-label")).toBeInTheDocument();
    expect(screen.getByTestId("change-password-submit")).toBeInTheDocument();
  });

  it("shows validation error when submitting with empty current password", async () => {
    render(<ChangePasswordPage />);

    fireEvent.click(screen.getByTestId("change-password-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("current-password-error")).toBeInTheDocument();
    });
  });

  it("shows password mismatch error when passwords differ", async () => {
    render(<ChangePasswordPage />);

    const currentInput = screen.getByTestId("current-password-input");
    const newInput = screen.getByTestId("new-password-input");
    const confirmInput = screen.getByTestId("confirm-password-input");

    fireEvent.change(currentInput, { target: { value: "current-pass" } });
    fireEvent.change(newInput, { target: { value: "newpassword1" } });
    fireEvent.change(confirmInput, { target: { value: "different-pass" } });
    fireEvent.click(screen.getByTestId("change-password-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-password-error")).toBeInTheDocument();
    });
  });

  it("shows error when mutation fails", () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
    });

    render(<ChangePasswordPage />);

    expect(screen.getByTestId("change-password-error")).toBeInTheDocument();
  });

  it("disables submit button while pending", () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      isError: false,
    });

    render(<ChangePasswordPage />);

    expect(screen.getByTestId("change-password-submit")).toBeDisabled();
  });
});
