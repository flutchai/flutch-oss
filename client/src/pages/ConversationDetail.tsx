import { useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { conversationsApi } from "@/api/conversations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ArrowLeft, User, Bot } from "lucide-react";

export function ConversationDetailPage() {
  const { id } = useParams({ from: "/conversations/$id" });

  const { data: thread, isLoading } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => conversationsApi.getThread(id),
  });

  if (isLoading)
    return (
      <div className="p-6 text-sm text-muted-fg" data-testid="conversation-loading">
        Loading...
      </div>
    );
  if (!thread)
    return (
      <div className="p-6 text-sm text-muted-fg" data-testid="conversation-not-found">
        Conversation not found
      </div>
    );

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/conversations">
          <Button size="sm" variant="outline" data-testid="back-button">
            <ArrowLeft size={14} /> Back
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold" data-testid="thread-agent-id">
              {thread.agentId}
            </h1>
            <Badge data-testid="platform-badge">{thread.platform}</Badge>
          </div>
          <p className="text-xs text-muted-fg font-mono mt-0.5">{thread.id}</p>
        </div>
      </div>

      {/* User info */}
      <div className="bg-card rounded-lg border border-border p-4 text-sm">
        <p className="font-medium mb-2">User</p>
        <div className="space-y-1">
          <p className="text-muted-fg font-mono text-xs">{thread.user?.id}</p>
          {thread.user?.identities?.map(i => (
            <div key={i.platform + i.externalId} className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]" data-testid="platform-badge">
                {i.platform}
              </Badge>
              <span className="text-xs font-mono" data-testid="identity-external-id">
                {i.externalId}
              </span>
              {i.metadata?.username && (
                <span className="text-xs text-muted-fg" data-testid="identity-username">
                  @{i.metadata.username}
                </span>
              )}
              {!!i.metadata?.first_name && (
                <span className="text-xs text-muted-fg">{i.metadata.first_name as string}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        {thread.messages.map(msg => (
          <div
            key={msg.id}
            className={cn("flex gap-3", msg.direction === "outgoing" && "flex-row-reverse")}
            data-testid={`message-${msg.direction}`}
          >
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1",
                msg.direction === "incoming" ? "bg-muted" : "bg-primary/10"
              )}
            >
              {msg.direction === "incoming" ? (
                <User size={13} className="text-muted-fg" />
              ) : (
                <Bot size={13} className="text-primary" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[75%] rounded-lg px-4 py-2.5",
                msg.direction === "incoming"
                  ? "bg-card border border-border text-foreground"
                  : "bg-primary/10 text-foreground"
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p className="text-[10px] text-muted-fg mt-1">{formatDate(msg.createdAt)}</p>
            </div>
          </div>
        ))}
        {thread.messages.length === 0 && (
          <p className="text-sm text-muted-fg text-center py-8" data-testid="messages-empty">
            No messages
          </p>
        )}
      </div>
    </div>
  );
}
