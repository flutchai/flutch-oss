import { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { usersApi } from "@/api/users";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

export function MobileUserDetail() {
  const { id } = useParams({ strict: false }) as { id: string };
  const queryClient = useQueryClient();
  const [mergeTargetId, setMergeTargetId] = useState("");

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: () => usersApi.getUser(id),
  });

  const merge = useMutation({
    mutationFn: () => usersApi.mergeUsers(id, mergeTargetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setMergeTargetId("");
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-fg" data-testid="user-loading">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 text-sm text-muted-fg" data-testid="user-not-found">
        User not found
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center gap-3 z-10">
        <Link to="/m/users" data-testid="back-button">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-base font-semibold">User</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* User ID card */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-fg mb-1">User ID</p>
            <p className="font-mono text-sm break-all" data-testid="user-id">
              {user.id}
            </p>
            <p className="text-xs text-muted-fg mt-2">Created: {formatDate(user.createdAt)}</p>
          </CardContent>
        </Card>

        {/* Identities */}
        <div>
          <p className="text-sm font-semibold mb-2">Identities</p>
          {!user.identities?.length && (
            <p className="text-sm text-muted-fg" data-testid="identities-empty">
              No identities
            </p>
          )}
          <div className="space-y-2">
            {user.identities?.map(i => (
              <Card key={i.platform + i.externalId} data-testid="identity-row">
                <CardContent className="p-3 flex items-center gap-3">
                  <Badge variant="outline" data-testid="identity-platform">
                    {i.platform}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium" data-testid="identity-external-id">
                      {i.metadata?.username ? `@${i.metadata.username}` : i.externalId}
                    </p>
                    {!!i.metadata?.first_name && (
                      <p className="text-xs text-muted-fg">
                        {i.metadata.first_name as string}
                        {i.metadata?.last_name ? ` ${i.metadata.last_name as string}` : ""}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Conversations */}
        <div>
          <p className="text-sm font-semibold mb-2">Conversations</p>
          {!user.threads?.length && (
            <p className="text-sm text-muted-fg" data-testid="conversations-empty">
              No conversations
            </p>
          )}
          <div className="space-y-2">
            {user.threads?.map(t => (
              <Link
                key={t.id}
                to="/m/conversations/$id"
                params={{ id: t.id }}
                data-testid="thread-link"
              >
                <Card>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-mono truncate max-w-[200px]">{t.id}</p>
                      <Badge variant="outline" className="text-[10px] mt-1">
                        {t.platform}
                      </Badge>
                    </div>
                    <ChevronRight size={16} className="text-muted-fg" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Merge */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-1" data-testid="merge-dialog-title">
              Merge with another user
            </p>
            <p className="text-xs text-muted-fg mb-3">
              All identities and conversations will be transferred to the target user. This user
              will be deleted.
            </p>
            <div className="space-y-2">
              <Input
                placeholder="Target user UUID"
                value={mergeTargetId}
                onChange={e => setMergeTargetId(e.target.value)}
                className="font-mono text-xs"
                data-testid="merge-target-input"
              />
              <Button
                className="w-full"
                variant="destructive"
                disabled={!mergeTargetId || merge.isPending}
                onClick={() => merge.mutate()}
                data-testid="merge-button"
              >
                {merge.isPending ? "..." : "Merge"}
              </Button>
              {merge.isError && <p className="text-xs text-destructive">Error: check the ID</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
