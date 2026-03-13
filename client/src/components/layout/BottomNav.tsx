import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, MessageSquare, Users, Bot, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    to: "/m/",
    testId: "bottom-nav-dashboard",
    isActive: (pathname: string) => pathname === "/m/" || pathname === "/m",
  },
  {
    label: "Conversations",
    icon: MessageSquare,
    to: "/m/conversations",
    testId: "bottom-nav-conversations",
    isActive: (pathname: string) => pathname.startsWith("/m/conversations"),
  },
  {
    label: "Users",
    icon: Users,
    to: "/m/users",
    testId: "bottom-nav-users",
    isActive: (pathname: string) => pathname.startsWith("/m/users"),
  },
  {
    label: "Agents",
    icon: Bot,
    to: "/m/agents",
    testId: "bottom-nav-agents",
    isActive: (pathname: string) => pathname.startsWith("/m/agents"),
  },
  {
    label: "Settings",
    icon: Settings,
    to: "/m/settings",
    testId: "bottom-nav-settings",
    isActive: (pathname: string) => pathname.startsWith("/m/settings"),
  },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-50 flex items-stretch"
    >
      {navItems.map(({ label, icon: Icon, to, testId, isActive }) => {
        const active = isActive(location.pathname);
        return (
          <Link
            key={to}
            to={to}
            data-testid={testId}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors",
              active ? "text-primary" : "text-muted-fg"
            )}
          >
            <Icon size={20} />
            <span className="text-[12px] font-medium leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
