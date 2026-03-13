import { createRouter, createRoute, createRootRoute, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth";
import { isMobileUserAgent } from "@/lib/utils";
import { RootLayout } from "@/components/layout/RootLayout";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { LoginPage } from "@/pages/Login";
import { ChangePasswordPage } from "@/pages/ChangePassword";
import { DashboardPage } from "@/pages/Dashboard";
import { AgentsPage } from "@/pages/Agents";
import { ConversationsPage } from "@/pages/Conversations";
import { ConversationDetailPage } from "@/pages/ConversationDetail";
import { UsersPage } from "@/pages/Users";
import { UserDetailPage } from "@/pages/UserDetail";
import { SettingsPage } from "@/pages/Settings";
import { MobileConversations } from "@/pages/mobile/MobileConversations";
import { MobileUsers } from "@/pages/mobile/MobileUsers";
import { MobileDashboard } from "@/pages/mobile/MobileDashboard";
import { MobileAgents } from "@/pages/mobile/MobileAgents";
import { MobileConversationDetail } from "@/pages/mobile/MobileConversationDetail";
import { MobileUserDetail } from "@/pages/mobile/MobileUserDetail";
import { MobileSettings } from "@/pages/mobile/MobileSettings";

// ─── Root ─────────────────────────────────────────────────────────────────────

const rootRoute = createRootRoute({ component: RootLayout });

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function requireAuth() {
  const { token, mustChangePassword } = useAuthStore.getState();
  if (!token) throw redirect({ to: "/login" });
  if (mustChangePassword) throw redirect({ to: "/change-password" });
}

function requireMobileAuth() {
  const { token, mustChangePassword } = useAuthStore.getState();
  if (!token) throw redirect({ to: "/m/login" });
  if (mustChangePassword) throw redirect({ to: "/m/change-password" });
}

// ─── Desktop routes ───────────────────────────────────────────────────────────

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
  beforeLoad: () => {
    const { token, mustChangePassword } = useAuthStore.getState();
    if (token && !mustChangePassword) throw redirect({ to: "/" });
  },
});

const changePasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/change-password",
  component: ChangePasswordPage,
  beforeLoad: () => {
    const { token } = useAuthStore.getState();
    if (!token) throw redirect({ to: "/login" });
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
  beforeLoad: () => {
    requireAuth();
    if (isMobileUserAgent()) throw redirect({ to: "/m" });
  },
});

const agentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agents",
  component: AgentsPage,
  beforeLoad: requireAuth,
});

const conversationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/conversations",
  component: ConversationsPage,
  beforeLoad: requireAuth,
});

const conversationDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/conversations/$id",
  component: ConversationDetailPage,
  beforeLoad: requireAuth,
});

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users",
  component: UsersPage,
  beforeLoad: requireAuth,
});

const userDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users/$id",
  component: UserDetailPage,
  beforeLoad: requireAuth,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
  beforeLoad: requireAuth,
});

// ─── Mobile routes ────────────────────────────────────────────────────────────

const mobileRootRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/m",
  component: MobileLayout,
});

const mobileLoginRoute = createRoute({
  getParentRoute: () => mobileRootRoute,
  path: "/login",
  component: () => <LoginPage redirectTo="/m" />,
  beforeLoad: () => {
    const { token, mustChangePassword } = useAuthStore.getState();
    if (token && !mustChangePassword) throw redirect({ to: "/m" });
  },
});

const mobileChangePasswordRoute = createRoute({
  getParentRoute: () => mobileRootRoute,
  path: "/change-password",
  component: () => <ChangePasswordPage redirectTo="/m/" />,
  beforeLoad: () => {
    const { token } = useAuthStore.getState();
    if (!token) throw redirect({ to: "/m/login" });
  },
});

const mobileDashboardRoute = createRoute({
  getParentRoute: () => mobileRootRoute,
  path: "/",
  component: MobileDashboard,
  beforeLoad: requireMobileAuth,
});

const mobileAgentsRoute = createRoute({
  getParentRoute: () => mobileRootRoute,
  path: "/agents",
  component: MobileAgents,
  beforeLoad: requireMobileAuth,
});

const mobileConversationsRoute = createRoute({
  getParentRoute: () => mobileRootRoute,
  path: "/conversations",
  component: MobileConversations,
  beforeLoad: requireMobileAuth,
});

const mobileConversationDetailRoute = createRoute({
  getParentRoute: () => mobileRootRoute,
  path: "/conversations/$id",
  component: MobileConversationDetail,
  beforeLoad: requireMobileAuth,
});

const mobileUsersRoute = createRoute({
  getParentRoute: () => mobileRootRoute,
  path: "/users",
  component: MobileUsers,
  beforeLoad: requireMobileAuth,
});

const mobileUserDetailRoute = createRoute({
  getParentRoute: () => mobileRootRoute,
  path: "/users/$id",
  component: MobileUserDetail,
  beforeLoad: requireMobileAuth,
});

const mobileSettingsRoute = createRoute({
  getParentRoute: () => mobileRootRoute,
  path: "/settings",
  component: MobileSettings,
  beforeLoad: requireMobileAuth,
});

// ─── Route tree ───────────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
  loginRoute,
  changePasswordRoute,
  dashboardRoute,
  agentsRoute,
  conversationsRoute,
  conversationDetailRoute,
  usersRoute,
  userDetailRoute,
  settingsRoute,
  mobileRootRoute.addChildren([
    mobileLoginRoute,
    mobileChangePasswordRoute,
    mobileDashboardRoute,
    mobileAgentsRoute,
    mobileConversationsRoute,
    mobileConversationDetailRoute,
    mobileUsersRoute,
    mobileUserDetailRoute,
    mobileSettingsRoute,
  ]),
]);

export const router = createRouter({ routeTree, basepath: "/admin" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
