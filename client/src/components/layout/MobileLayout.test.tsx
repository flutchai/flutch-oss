import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => React.createElement("div", { "data-testid": "outlet-content" }, "Page content"),
  Link: ({ children, to, "data-testid": testid, className }: any) =>
    React.createElement("a", { href: to, "data-testid": testid, className }, children),
  useLocation: () => ({ pathname: "/m/" }),
}));

const { MobileLayout } = await import("./MobileLayout");

describe("MobileLayout", () => {
  it("renders the outlet", () => {
    render(<MobileLayout />);
    expect(screen.getByTestId("outlet-content")).toBeInTheDocument();
  });

  it("renders the bottom nav", () => {
    render(<MobileLayout />);
    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
  });

  it("bottom nav contains all nav items", () => {
    render(<MobileLayout />);
    expect(screen.getByTestId("bottom-nav-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav-conversations")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav-users")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav-agents")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav-settings")).toBeInTheDocument();
  });
});
