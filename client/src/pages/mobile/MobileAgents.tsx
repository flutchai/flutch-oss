import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "@/api/agents";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function MobileAgents() {
  const { data: agents, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: agentsApi.list,
  });

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="pt-2 pb-1 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Agents</h1>
        <span className="text-xs text-muted-fg">read-only</span>
      </div>

      {isLoading && (
        <div data-testid="agents-loading" className="text-sm text-muted-fg">
          Loading...
        </div>
      )}

      {!isLoading && agents?.length === 0 && (
        <div data-testid="agents-empty-state" className="text-sm text-muted-fg">
          No agents. Add configuration to agents.json
        </div>
      )}

      {agents && agents.length > 0 && (
        <div className="space-y-3" data-testid="agents-list">
          {agents.map(agent => {
            const hasPlatforms =
              agent.platforms.telegram?.configured || agent.platforms.widget?.configured;

            return (
              <Card key={agent.id} data-testid={`agent-card-${agent.id}`}>
                <CardContent className="p-4 space-y-3">
                  {/* Top: ID + graph type */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-sm font-semibold" data-testid="agent-id">
                      {agent.id}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0"
                      data-testid="agent-graph-type"
                    >
                      {agent.graphType}
                    </Badge>
                  </div>

                  {/* Model */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-fg">Model</span>
                    <code
                      className="text-xs bg-muted rounded px-1.5 py-0.5"
                      data-testid="agent-model"
                    >
                      {agent.graphSettings.model ?? "—"}
                    </code>
                  </div>

                  {/* Platform badges */}
                  {hasPlatforms && (
                    <div className="flex flex-wrap gap-1">
                      {agent.platforms.telegram?.configured && (
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                          data-testid="platform-badge-telegram"
                        >
                          Telegram
                        </Badge>
                      )}
                      {agent.platforms.widget?.configured && (
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                          data-testid="platform-badge-widget"
                        >
                          Widget
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* System prompt preview */}
                  {agent.graphSettings.systemPrompt && (
                    <p
                      className="text-xs text-muted-fg line-clamp-2"
                      data-testid="agent-system-prompt"
                    >
                      {agent.graphSettings.systemPrompt}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
