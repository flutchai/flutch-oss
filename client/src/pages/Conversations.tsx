import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { conversationsApi } from "@/api/conversations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";

export function ConversationsPage() {
  const [page, setPage] = useState(1);
  const [platform, setPlatform] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["conversations", page, platform],
    queryFn: () => conversationsApi.list({ page, limit: 20, platform: platform || undefined }),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" data-testid="conversations-heading">
            Conversations
          </h1>
          <p className="text-sm text-muted-fg mt-0.5" data-testid="conversations-total">
            {data?.total ?? 0} conversations
          </p>
        </div>
        <div className="flex gap-2">
          {["", "telegram", "widget", "api"].map(p => (
            <Button
              key={p}
              size="sm"
              variant={platform === p ? "default" : "outline"}
              onClick={() => {
                setPlatform(p);
                setPage(1);
              }}
              data-testid={`filter-${p || "all"}`}
            >
              {p || "All"}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div
              className="py-12 text-center text-sm text-muted-fg"
              data-testid="conversations-loading"
            >
              Loading...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thread ID</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map(thread => (
                  <TableRow key={thread.id} data-testid={`thread-row-${thread.id}`}>
                    <TableCell className="font-mono text-xs text-muted-fg" data-testid="thread-id">
                      {thread.id.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="font-medium text-sm" data-testid="thread-agent">
                      {thread.agentId}
                    </TableCell>
                    <TableCell>
                      <PlatformBadge platform={thread.platform} />
                    </TableCell>
                    <TableCell data-testid="thread-messages">
                      <span className="flex items-center gap-1 text-sm">
                        <MessageSquare size={12} className="text-muted-fg" />
                        {thread.messageCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-fg">
                      {formatDate(thread.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link to="/conversations/$id" params={{ id: thread.id }}>
                        <Button size="sm" variant="ghost" data-testid="thread-open">
                          Open →
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.data.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-fg py-12"
                      data-testid="conversations-empty"
                    >
                      No conversations
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-fg" data-testid="pagination-info">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => p - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const variants: Record<string, "default" | "secondary" | "outline"> = {
    telegram: "default",
    widget: "secondary",
    api: "outline",
  };
  return <Badge variant={variants[platform] ?? "outline"}>{platform}</Badge>;
}
