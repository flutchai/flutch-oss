import { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/api/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, GitMerge, MessageSquare } from "lucide-react";

export function UserDetailPage() {
  const { id } = useParams({ from: "/users/$id" });
  const queryClient = useQueryClient();
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [showMerge, setShowMerge] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: () => usersApi.getUser(id),
  });

  const merge = useMutation({
    mutationFn: () => usersApi.mergeUsers(id, mergeTargetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowMerge(false);
      setMergeTargetId("");
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-fg" data-testid="user-loading">Loading...</div>;
  if (!user) return <div className="p-6 text-sm text-muted-fg" data-testid="user-not-found">User not found</div>;

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/users">
          <Button size="sm" variant="outline" data-testid="back-button">
            <ArrowLeft size={14} /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold" data-testid="user-heading">User</h1>
          <p className="text-xs text-muted-fg font-mono" data-testid="user-id">{user.id}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto gap-1.5"
          onClick={() => setShowMerge(v => !v)}
          data-testid="merge-toggle-button"
        >
          <GitMerge size={13} /> Merge
        </Button>
      </div>

      {/* Merge UI */}
      {showMerge && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium" data-testid="merge-title">Merge this user with another</p>
            <p className="text-xs text-muted-fg" data-testid="merge-description">
              All identities and conversations of <strong>this</strong> user will be transferred to the target. This user will be deleted.
            </p>
            <div className="flex gap-2">
              <Input
                value={mergeTargetId}
                onChange={e => setMergeTargetId(e.target.value)}
                placeholder="Target user UUID"
                className="font-mono text-xs"
                data-testid="merge-target-input"
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={() => merge.mutate()}
                disabled={!mergeTargetId || merge.isPending}
                data-testid="merge-submit-button"
              >
                {merge.isPending ? "..." : "Merge"}
              </Button>
            </div>
            {merge.isError && <p className="text-xs text-destructive" data-testid="merge-error">Error: check the ID</p>}
          </CardContent>
        </Card>
      )}

      {/* Identities */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm" data-testid="identities-heading">Identities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {user.identities?.map(i => (
            <div
              key={i.platform + i.externalId}
              className="flex items-center gap-3 text-sm bg-muted rounded p-3"
              data-testid="identity-row"
            >
              <Badge variant="outline" data-testid="identity-platform">{i.platform}</Badge>
              <span className="font-mono text-xs" data-testid="identity-external-id">{i.externalId}</span>
              {i.metadata?.username && (
                <span className="text-muted-fg" data-testid="identity-username">@{i.metadata.username}</span>
              )}
              {!!i.metadata?.first_name && (
                <span className="text-muted-fg" data-testid="identity-first-name">{i.metadata.first_name as string}</span>
              )}
            </div>
          ))}
          {!user.identities?.length && <p className="text-sm text-muted-fg" data-testid="identities-empty">No identities</p>}
        </CardContent>
      </Card>

      {/* Threads */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2" data-testid="conversations-heading">
            <MessageSquare size={13} /> Conversations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {user.threads?.map(t => (
            <Link key={t.id} to="/conversations/$id" params={{ id: t.id }} data-testid="thread-link">
              <div className="flex items-center gap-3 text-sm bg-muted hover:bg-muted/70 rounded p-3 transition-colors">
                <Badge>{t.platform}</Badge>
                <span className="font-medium">{t.agentId}</span>
                <span className="text-muted-fg ml-auto">{formatDate(t.createdAt)}</span>
              </div>
            </Link>
          ))}
          {!user.threads?.length && <p className="text-sm text-muted-fg" data-testid="conversations-empty">No conversations</p>}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-fg">Created: {formatDate(user.createdAt)}</p>
    </div>
  );
}
