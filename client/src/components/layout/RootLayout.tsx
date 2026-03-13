import { Outlet, useLocation } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { useAuthStore } from "@/store/auth";

const NO_SIDEBAR_PATHS = ["/login", "/change-password"];

export function RootLayout() {
  const location = useLocation();
  const token = useAuthStore(s => s.token);
  const isMobile = location.pathname.startsWith("/m");
  const showSidebar = token && !NO_SIDEBAR_PATHS.includes(location.pathname) && !isMobile;

  if (!showSidebar) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
