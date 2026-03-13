import { useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { conversationsApi } from "@/api/conversations";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

export function MobileConversationDetail() {
  const { id } = useParams({ strict: false }) as { id: string };

  const { data: thread, isLoading } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => conversationsApi.getThread(id),
  });

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-fg" data-testid="conversation-loading">
        Loading...
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="p-4 text-sm text-muted-fg" data-testid="conversation-not-found">
        Conversation not found
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center gap-3 z-10">
        <Link to="/m/conversations" data-testid="back-button">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" data-testid="thread-agent-id">
            {thread.agentId}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]" data-testid="platform-badge">
              {thread.platform}
            </Badge>
            <span className="text-xs text-muted-fg">{thread.user?.id}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-3 flex-1">
        {thread.messages.length === 0 && (
          <div
            data-testid="messages-empty"
            className="text-center py-12 text-sm text-muted-fg"
          >
            No messages
          </div>
        )}
        {thread.messages.map(msg => (
          <div
            key={msg.id}
            className={cn("flex", msg.direction === "outgoing" ? "justify-end" : "justify-start")}
            data-testid={`message-${msg.direction}`}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                msg.direction === "outgoing"
                  ? "bg-primary text-white rounded-br-sm"
                  : "bg-card border rounded-bl-sm"
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className="text-[10px] opacity-60 mt-1">{formatDate(msg.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
