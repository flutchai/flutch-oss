import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { conversationsApi } from "@/api/conversations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PLATFORMS = ["", "telegram", "widget", "api"] as const;

export function MobileConversations() {
  const [page, setPage] = useState(1);
  const [platform, setPlatform] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["conversations", page, platform],
    queryFn: () => conversationsApi.list({ page, limit: 15, platform: platform || undefined }),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-semibold text-foreground">Conversations</h1>
        <span className="text-sm text-muted-fg" data-testid="conversations-total">
          {data?.total ?? 0} total
        </span>
      </div>

      {/* Platform filter — horizontally scrollable */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {PLATFORMS.map(p => (
          <Button
            key={p || "all"}
            size="sm"
            variant={platform === p ? "default" : "outline"}
            onClick={() => {
              setPlatform(p);
              setPage(1);
            }}
            data-testid={`filter-${p || "all"}`}
            className="shrink-0"
          >
            {p || "All"}
          </Button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div data-testid="conversations-loading" className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-4 animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div data-testid="mobile-conversations-list" className="space-y-3">
          {data?.data.length === 0 && (
            <div
              data-testid="conversations-empty"
              className="py-12 text-center text-sm text-muted-fg"
            >
              No conversations
            </div>
          )}
          {data?.data.map(thread => (
            <Link
              key={thread.id}
              to="/m/conversations/$id"
              params={{ id: thread.id }}
              data-testid={`conversation-card-${thread.id}`}
            >
              <div className="bg-card rounded-lg border p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">{thread.platform}</Badge>
                  <span className="text-xs text-muted-fg">{relativeTime(thread.createdAt)}</span>
                </div>
                <p className="text-sm font-mono truncate text-foreground">{thread.id}</p>
                <div className="flex gap-2 mt-2 text-xs text-muted-fg">
                  <span>{thread.agentId}</span>
                  <span>·</span>
                  <span>{thread.messageCount} messages</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(p => p - 1)}
            disabled={page <= 1}
            data-testid="pagination-prev"
          >
            <ChevronLeft size={14} />
            Prev
          </Button>
          <span className="text-sm text-muted-fg" data-testid="pagination-info">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
            data-testid="pagination-next"
          >
            Next
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
