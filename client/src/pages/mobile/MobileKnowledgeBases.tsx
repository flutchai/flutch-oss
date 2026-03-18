import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { kbApi } from "@/api/knowledgeBase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, X, BookOpen } from "lucide-react";

export function MobileKnowledgeBases() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge-bases", page],
    queryFn: () => kbApi.list({ page, limit: 15 }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      kbApi.create({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      setShowCreate(false);
      setName("");
      setDescription("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => kbApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] }),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-semibold" data-testid="mobile-kb-heading">
          Knowledge Bases
        </h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreate(s => !s)}
          data-testid="mobile-kb-create-button"
        >
          {showCreate ? <X size={14} /> : <Plus size={14} />}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card data-testid="mobile-kb-create-form">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New Knowledge Base</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name *"
              data-testid="mobile-kb-name-input"
            />
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description (optional)"
              data-testid="mobile-kb-description-input"
            />
            <Button
              size="sm"
              className="w-full"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid="mobile-kb-create-submit"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
            {createMutation.isError && (
              <p className="text-sm text-red-500" data-testid="mobile-kb-create-error">
                Failed to create knowledge base
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* List */}
      {isLoading ? (
        <div data-testid="mobile-kb-loading" className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-4 animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div data-testid="mobile-kb-list" className="space-y-3">
          {data?.data.length === 0 && (
            <div data-testid="mobile-kb-empty" className="py-12 text-center text-sm text-muted-fg">
              No knowledge bases yet
            </div>
          )}
          {data?.data.map(kb => (
            <div key={kb.id} className="relative" data-testid={`mobile-kb-card-${kb.id}`}>
              <Link
                to="/m/knowledge-bases/$id"
                params={{ id: kb.id }}
              >
                <div className="bg-card rounded-lg border p-4 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-medium text-sm text-foreground" data-testid={`mobile-kb-name-${kb.id}`}>
                      {kb.name}
                    </p>
                    <Badge
                      variant={kb.visibilityStatus === "published" ? "default" : "secondary"}
                      data-testid={`mobile-kb-status-${kb.id}`}
                    >
                      {kb.visibilityStatus}
                    </Badge>
                  </div>
                  {kb.description && (
                    <p className="text-xs text-muted-fg mb-2 line-clamp-2">{kb.description}</p>
                  )}
                  <div className="flex gap-3 text-xs text-muted-fg">
                    <span className="flex items-center gap-1" data-testid={`mobile-kb-article-count-${kb.id}`}>
                      <BookOpen size={11} />
                      {kb.articleCount} articles
                    </span>
                    <span className="capitalize">{kb.contentType.replace(/_/g, " ")}</span>
                    <span>{relativeTime(kb.createdAt)}</span>
                  </div>
                </div>
              </Link>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-3 right-3 z-10"
                onClick={e => {
                  e.preventDefault();
                  if (confirm(`Delete "${kb.name}"? This will also delete all articles.`)) {
                    deleteMutation.mutate(kb.id);
                  }
                }}
                data-testid={`kb-delete-${kb.id}`}
              >
                Delete
              </Button>
            </div>
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
            data-testid="mobile-kb-pagination-prev"
          >
            <ChevronLeft size={14} /> Prev
          </Button>
          <span className="text-sm text-muted-fg" data-testid="mobile-kb-pagination-info">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
            data-testid="mobile-kb-pagination-next"
          >
            Next <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
