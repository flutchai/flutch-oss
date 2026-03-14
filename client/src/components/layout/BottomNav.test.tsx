import { render, screen } from "@testing-library/react";
import React from "react";

const mockUseLocation = vi.fn(() => ({ pathname: "/m/" }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, "data-testid": testid, className }: any) =>
    React.createElement("a", { href: to, "data-testid": testid, className }, children),
  useLocation: () => mockUseLocation(),
}));

const { BottomNav } = await import("./BottomNav");

describe("BottomNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: "/m/" });
  });

  it("renders the bottom nav container", () => {
    render(<BottomNav />);
    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
  });

  it("renders all nav items", () => {
    render(<BottomNav />);
    expect(screen.getByTestId("bottom-nav-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav-conversations")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav-users")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav-agents")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav-settings")).toBeInTheDocument();
  });

  it("applies active color to Dashboard on /m/ path", () => {
    mockUseLocation.mockReturnValue({ pathname: "/m/" });
    render(<BottomNav />);
    const dashboardLink = screen.getByTestId("bottom-nav-dashboard");
    expect(dashboardLink.className).toContain("text-primary");
  });

  it("applies inactive color to non-active items on /m/ path", () => {
    mockUseLocation.mockReturnValue({ pathname: "/m/" });
    render(<BottomNav />);
    const agentsLink = screen.getByTestId("bottom-nav-agents");
    expect(agentsLink.className).toContain("text-muted-fg");
  });

  it("applies active color to Conversations on /m/conversations path", () => {
    mockUseLocation.mockReturnValue({ pathname: "/m/conversations" });
    render(<BottomNav />);
    const link = screen.getByTestId("bottom-nav-conversations");
    expect(link.className).toContain("text-primary");
  });

  it("applies active color to Users on /m/users path", () => {
    mockUseLocation.mockReturnValue({ pathname: "/m/users" });
    render(<BottomNav />);
    const link = screen.getByTestId("bottom-nav-users");
    expect(link.className).toContain("text-primary");
  });

  it("applies active color to Agents on /m/agents path", () => {
    mockUseLocation.mockReturnValue({ pathname: "/m/agents" });
    render(<BottomNav />);
    const link = screen.getByTestId("bottom-nav-agents");
    expect(link.className).toContain("text-primary");
  });

  it("applies active color to Settings on /m/settings path", () => {
    mockUseLocation.mockReturnValue({ pathname: "/m/settings" });
    render(<BottomNav />);
    const link = screen.getByTestId("bottom-nav-settings");
    expect(link.className).toContain("text-primary");
  });

  it("applies active to Dashboard on /m (without trailing slash)", () => {
    mockUseLocation.mockReturnValue({ pathname: "/m" });
    render(<BottomNav />);
    const dashboardLink = screen.getByTestId("bottom-nav-dashboard");
    expect(dashboardLink.className).toContain("text-primary");
  });

  it("applies active to Conversations on nested conversation path", () => {
    mockUseLocation.mockReturnValue({ pathname: "/m/conversations/thread-abc" });
    render(<BottomNav />);
    const link = screen.getByTestId("bottom-nav-conversations");
    expect(link.className).toContain("text-primary");
  });
});
