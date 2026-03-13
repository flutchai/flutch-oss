import { useQuery } from "@tanstack/react-query";
import { agentsApi, type Agent } from "@/api/agents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageSquare, Globe } from "lucide-react";

export function AgentsPage() {
  const { data: agents, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: agentsApi.list,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 data-testid="agents-heading" className="text-xl font-semibold text-foreground">Agents</h1>
        <p data-testid="agents-subtitle" className="text-sm text-muted-fg mt-0.5">
          Agent configuration from agents.json (read-only)
        </p>
      </div>

      {isLoading && <div data-testid="agents-loading" className="text-sm text-muted-fg">Loading...</div>}

      <div className="grid gap-4">
        {agents?.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
        {agents?.length === 0 && (
          <Card>
            <CardContent data-testid="agents-empty" className="py-12 text-center text-sm text-muted-fg">
              No agents. Add configuration to agents.json
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Card data-testid={`agent-card-${agent.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Bot size={16} className="text-primary" />
          </div>
          <div>
            <CardTitle data-testid="agent-id" className="text-base">{agent.id}</CardTitle>
            <p data-testid="agent-graph-type" className="text-xs text-muted-fg mt-0.5">{agent.graphType}</p>
          </div>
          <div className="ml-auto flex gap-2">
            {agent.platforms.telegram?.configured && (
              <Badge data-testid="platform-badge-telegram" variant="secondary" className="gap-1">
                <MessageSquare size={10} /> Telegram
              </Badge>
            )}
            {agent.platforms.widget?.configured && (
              <Badge data-testid="platform-badge-widget" variant="secondary" className="gap-1">
                <Globe size={10} /> Widget
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-fg mb-1">Model</p>
            <p data-testid="agent-model" className="font-mono text-xs bg-muted rounded px-2 py-1">
              {agent.graphSettings.model ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-fg mb-1">Temperature</p>
            <p className="font-mono text-xs bg-muted rounded px-2 py-1">
              {agent.graphSettings.temperature ?? "—"}
            </p>
          </div>
          {agent.platforms.telegram && (
            <div>
              <p className="text-xs text-muted-fg mb-1">Bot Token</p>
              <p data-testid="agent-bot-token" className="font-mono text-xs bg-muted rounded px-2 py-1">
                {agent.platforms.telegram.botTokenMasked}
              </p>
            </div>
          )}
          {agent.platforms.widget && (
            <div>
              <p className="text-xs text-muted-fg mb-1">Widget Key</p>
              <p className="font-mono text-xs bg-muted rounded px-2 py-1">
                {agent.platforms.widget.widgetKey}
              </p>
            </div>
          )}
        </div>
        {agent.graphSettings.systemPrompt && (
          <div>
            <p className="text-xs text-muted-fg mb-1">System Prompt</p>
            <p data-testid="agent-system-prompt" className="text-sm bg-muted rounded px-3 py-2 text-foreground/80 line-clamp-3">
              {agent.graphSettings.systemPrompt}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
