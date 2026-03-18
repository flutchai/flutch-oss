import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageSquare, Users, Bot, Activity, BookOpen } from "lucide-react";
import { dashboardApi } from "@/api/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";

export function MobileDashboard() {
  const stats = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: dashboardApi.getStats,
    refetchInterval: 30_000,
  });
  const status = useQuery({
    queryKey: ["dashboard", "status"],
    queryFn: dashboardApi.getStatus,
    refetchInterval: 15_000,
  });
  const activity = useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: dashboardApi.getActivity,
    refetchInterval: 30_000,
  });

  const s = stats.data;
  const st = status.data;

  const statusItems = [
    { key: "engine", label: "Engine", ok: st?.engine ?? false },
    { key: "database", label: "Database", ok: st?.database ?? false },
  ];

  const statItems = [
    { label: "Agents", value: s?.agents_count ?? "—", icon: Bot, testId: "stat-agents-count" },
    {
      label: "Threads today",
      value: s?.threads_today ?? "—",
      icon: MessageSquare,
      testId: "stat-threads-today",
    },
    {
      label: "Messages today",
      value: s?.messages_today ?? "—",
      icon: Activity,
      testId: "stat-messages-today",
    },
    { label: "Users", value: s?.users_total ?? "—", icon: Users, testId: "stat-users-total" },
  ];

  return (
    <div className="p-4 space-y-4" data-testid="mobile-dashboard">
      {/* Header */}
      <div className="pt-2 pb-1">
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </div>

      {/* System status */}
      <Card>
        <CardContent className="p-3 divide-y divide-border">
          {statusItems.map(item => (
            <div
              key={item.key}
              className="flex items-center justify-between py-2.5"
              data-testid={`status-${item.key}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${item.ok ? "bg-success" : "bg-destructive"}`}
                />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <span className="text-xs text-muted-fg">{item.ok ? "Online" : "Offline"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Stats 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {statItems.map(item => (
          <Card key={item.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <item.icon size={13} className="text-muted-fg" />
                <p className="text-xs text-muted-fg">{item.label}</p>
              </div>
              <p className="text-2xl font-bold" data-testid={item.testId}>
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Knowledge Base stats */}
      <Card data-testid="mobile-kb-stats">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen size={13} />
            Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 pt-0">
          <div>
            <p className="text-xs text-muted-fg mb-1">Bases</p>
            <p className="text-xl font-bold" data-testid="stat-kb-count">
              {s?.kb_count ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-fg mb-1">Total</p>
            <p className="text-xl font-bold" data-testid="stat-articles-total">
              {s?.articles_total ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-fg mb-1">Published</p>
            <p className="text-xl font-bold" data-testid="stat-articles-published">
              {s?.articles_published ?? "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent activity */}
      <div>
        <p className="text-sm font-semibold mb-2">Recent activity</p>
        {activity.isLoading && (
          <div data-testid="activity-loading" className="text-sm text-muted-fg py-4">
            Loading...
          </div>
        )}
        {!activity.isLoading && activity.data?.length === 0 && (
          <div data-testid="activity-empty" className="text-sm text-muted-fg py-4">
            No activity
          </div>
        )}
        {activity.data && activity.data.length > 0 && (
          <div className="space-y-2" data-testid="activity-list">
            {activity.data.slice(0, 5).map(item => (
              <Link
                key={item.id}
                to="/m/conversations/$id"
                params={{ id: item.threadId }}
                data-testid={`activity-item-${item.id}`}
              >
                <div className="bg-card border rounded-lg p-3 flex items-start gap-3">
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {item.platform}
                  </Badge>
                  <p className="text-sm truncate flex-1">{item.preview}</p>
                  <span className="text-xs text-muted-fg shrink-0">
                    {relativeTime(item.createdAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
