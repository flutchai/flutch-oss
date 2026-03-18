import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageSquare, Users, Bot, CheckCircle, XCircle, Activity, BookOpen } from "lucide-react";
import { dashboardApi } from "@/api/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, relativeTime } from "@/lib/utils";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full", ok ? "bg-success" : "bg-destructive")}
    />
  );
}

export function DashboardPage() {
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 data-testid="dashboard-heading" className="text-xl font-semibold text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-fg mt-0.5">System status and today's activity</p>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          {
            label: "Engine",
            ok: st?.engine ?? false,
            cardTestId: "status-card-engine",
            valueTestId: "status-card-engine-value",
          },
          {
            label: "PostgreSQL",
            ok: st?.database ?? false,
            cardTestId: "status-card-database",
            valueTestId: "status-card-database-value",
          },
        ].map(item => (
          <Card key={item.label} data-testid={item.cardTestId}>
            <CardContent className="flex items-center gap-3 p-4">
              <StatusDot ok={item.ok} />
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p data-testid={item.valueTestId} className="text-xs text-muted-fg">
                  {item.ok ? "Online" : "Offline"}
                </p>
              </div>
              {item.ok ? (
                <CheckCircle size={16} className="text-success ml-auto" />
              ) : (
                <XCircle size={16} className="text-destructive ml-auto" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Agents",
            value: s?.agents_count ?? "—",
            icon: Bot,
            valueTestId: "stat-agents-count",
          },
          {
            label: "Threads today",
            value: s?.threads_today ?? "—",
            icon: MessageSquare,
            valueTestId: "stat-threads-today",
          },
          {
            label: "Messages today",
            value: s?.messages_today ?? "—",
            icon: Activity,
            valueTestId: "stat-messages-today",
          },
          {
            label: "Users",
            value: s?.users_total ?? "—",
            icon: Users,
            valueTestId: "stat-users-total",
          },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-fg font-medium uppercase tracking-wide">
                  {item.label}
                </p>
                <item.icon size={15} className="text-muted-fg" />
              </div>
              <p data-testid={item.valueTestId} className="text-2xl font-bold text-foreground">
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Knowledge Base Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen size={15} />
            Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 pt-0">
          {[
            { label: "Knowledge Bases", value: s?.kb_count ?? "—", valueTestId: "stat-kb-count" },
            {
              label: "Articles total",
              value: s?.articles_total ?? "—",
              valueTestId: "stat-articles-total",
            },
            {
              label: "Published",
              value: s?.articles_published ?? "—",
              valueTestId: "stat-articles-published",
            },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-muted-fg font-medium uppercase tracking-wide mb-1">
                {item.label}
              </p>
              <p data-testid={item.valueTestId} className="text-2xl font-bold text-foreground">
                {item.value}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle
            data-testid="activity-heading"
            className="text-sm font-semibold flex items-center gap-2"
          >
            <Activity size={15} />
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activity.isLoading && (
            <div
              data-testid="activity-loading"
              className="px-6 py-8 text-center text-sm text-muted-fg"
            >
              Loading...
            </div>
          )}
          {activity.data?.length === 0 && (
            <div
              data-testid="activity-empty"
              className="px-6 py-8 text-center text-sm text-muted-fg"
            >
              No activity
            </div>
          )}
          <div className="divide-y divide-border">
            {activity.data?.map(item => (
              <Link
                key={item.id}
                data-testid="activity-item"
                to="/conversations/$id"
                params={{ id: item.threadId }}
                className="flex items-start gap-3 px-6 py-3 hover:bg-muted/50 transition-colors"
              >
                <MessageSquare size={14} className="text-muted-fg mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge
                      data-testid="activity-platform"
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {item.platform}
                    </Badge>
                    <span className="text-xs text-muted-fg">{item.agentId}</span>
                  </div>
                  <p data-testid="activity-preview" className="text-sm text-foreground truncate">
                    {item.preview}
                  </p>
                </div>
                <span className="text-xs text-muted-fg shrink-0">
                  {relativeTime(item.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
