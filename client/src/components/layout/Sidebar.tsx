import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Smartphone,
  BookOpen,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", testId: "nav-dashboard" },
  { to: "/agents", icon: Bot, label: "Agents", testId: "nav-agents" },
  {
    to: "/conversations",
    icon: MessageSquare,
    label: "Conversations",
    testId: "nav-conversations",
  },
  { to: "/users", icon: Users, label: "Users", testId: "nav-users" },
  { to: "/knowledge-bases", icon: BookOpen, label: "Knowledge Base", testId: "nav-knowledge-base" },
];

export function Sidebar() {
  const location = useLocation();
  const logout = useAuthStore(s => s.logout);

  return (
    <aside className="w-56 flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
          <span className="text-white text-sm font-bold">F</span>
        </div>
        <div>
          <p
            data-testid="sidebar-brand-title"
            className="text-sidebar-fg text-sm font-semibold leading-none"
          >
            Flutch OSS
          </p>
          <p data-testid="sidebar-brand-subtitle" className="text-sidebar-fg/50 text-xs mt-0.5">
            Admin Panel
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label, testId }) => {
          const isActive =
            to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              data-testid={testId}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-active text-white"
                  : "text-sidebar-fg/70 hover:bg-white/10 hover:text-sidebar-fg"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
        <Link
          to="/settings"
          data-testid="nav-settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            location.pathname === "/settings"
              ? "bg-sidebar-active text-white"
              : "text-sidebar-fg/70 hover:bg-white/10 hover:text-sidebar-fg"
          )}
        >
          <Settings size={16} />
          Settings
        </Link>
        <button
          onClick={logout}
          data-testid="logout-button"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-fg/70 hover:bg-white/10 hover:text-sidebar-fg transition-colors"
        >
          <LogOut size={16} />
          Log out
        </button>
        <a
          href="/admin/m/"
          data-testid="mobile-version-link"
          className="flex items-center gap-2 px-3 py-2 text-xs text-sidebar-fg/40 hover:text-sidebar-fg/60"
        >
          <Smartphone size={12} />
          Mobile version
        </a>
      </div>
    </aside>
  );
}
