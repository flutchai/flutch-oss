import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const mockLogout = vi.fn();
const mockUseLocation = vi.fn(() => ({ pathname: "/" }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className, "data-testid": testid }: any) =>
    React.createElement("a", { href: to, className, "data-testid": testid }, children),
  useLocation: () => mockUseLocation(),
}));

vi.mock("@/store/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({ token: "jwt", mustChangePassword: false, logout: mockLogout }),
}));

// Import after mocks
const { Sidebar } = await import("./Sidebar");

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: "/" });
  });

  it("renders the brand logo and title", () => {
    render(<Sidebar />);

    const title = screen.getByTestId("sidebar-brand-title");
    const subtitle = screen.getByTestId("sidebar-brand-subtitle");
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Flutch OSS");
    expect(subtitle).toBeInTheDocument();
    expect(subtitle).toHaveTextContent("Admin Panel");
  });

  it("renders all navigation items", () => {
    render(<Sidebar />);

    expect(screen.getByTestId("nav-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("nav-agents")).toBeInTheDocument();
    expect(screen.getByTestId("nav-conversations")).toBeInTheDocument();
    expect(screen.getByTestId("nav-users")).toBeInTheDocument();
    expect(screen.getByTestId("nav-settings")).toBeInTheDocument();
  });

  it("renders logout button", () => {
    render(<Sidebar />);

    expect(screen.getByTestId("logout-button")).toBeInTheDocument();
  });

  it("calls logout when logout button is clicked", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByTestId("logout-button"));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("applies active style to Dashboard link on / path", () => {
    mockUseLocation.mockReturnValue({ pathname: "/" });
    render(<Sidebar />);

    const dashboardLink = screen.getByTestId("nav-dashboard");
    expect(dashboardLink.className).toContain("bg-sidebar-active");
  });

  it("does not apply active style to other items on / path", () => {
    mockUseLocation.mockReturnValue({ pathname: "/" });
    render(<Sidebar />);

    const agentsLink = screen.getByTestId("nav-agents");
    expect(agentsLink.className).not.toContain("bg-sidebar-active");
  });

  it("applies active style to Agents link on /agents path", () => {
    mockUseLocation.mockReturnValue({ pathname: "/agents" });
    render(<Sidebar />);

    const agentsLink = screen.getByTestId("nav-agents");
    expect(agentsLink.className).toContain("bg-sidebar-active");
  });
});
