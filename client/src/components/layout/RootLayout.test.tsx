import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

const mockUseLocation = vi.fn(() => ({ pathname: "/" }));
const mockGetState = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => React.createElement("div", { "data-testid": "outlet" }, "Page Content"),
  useLocation: () => mockUseLocation(),
  Link: ({ children, to }: any) => React.createElement("a", { href: to }, children),
}));

vi.mock("@/store/auth", () => ({
  useAuthStore: (selector: any) => selector(mockGetState()),
}));

// Sidebar is imported transitively — mock it to simplify
vi.mock("./Sidebar", () => ({
  Sidebar: () => React.createElement("aside", { "data-testid": "sidebar" }, "Sidebar"),
}));

const { RootLayout } = await import("./RootLayout");

describe("RootLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Sidebar and Outlet when authenticated and on a regular path", () => {
    mockGetState.mockReturnValue({ token: "jwt-abc" });
    mockUseLocation.mockReturnValue({ pathname: "/" });

    render(<RootLayout />);

    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });

  it("hides Sidebar on /login path even with token", () => {
    mockGetState.mockReturnValue({ token: "jwt-abc" });
    mockUseLocation.mockReturnValue({ pathname: "/login" });

    render(<RootLayout />);

    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });

  it("hides Sidebar on /change-password path", () => {
    mockGetState.mockReturnValue({ token: "jwt-abc" });
    mockUseLocation.mockReturnValue({ pathname: "/change-password" });

    render(<RootLayout />);

    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  it("hides Sidebar when user is not authenticated", () => {
    mockGetState.mockReturnValue({ token: null });
    mockUseLocation.mockReturnValue({ pathname: "/" });

    render(<RootLayout />);

    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });
});
