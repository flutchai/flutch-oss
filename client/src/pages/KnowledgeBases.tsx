import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { kbApi } from "@/api/knowledgeBase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, X, BookOpen } from "lucide-react";

export function KnowledgeBasesPage() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge-bases", page],
    queryFn: () => kbApi.list({ page, limit: 20 }),
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
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" data-testid="kb-heading">
            Knowledge Bases
          </h1>
          <p className="text-sm text-muted-fg mt-0.5" data-testid="kb-total">
            {data?.total ?? 0} knowledge bases
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(s => !s)} data-testid="kb-create-button">
          {showCreate ? <X size={14} /> : <Plus size={14} />}
          <span className="ml-1">{showCreate ? "Cancel" : "New Knowledge Base"}</span>
        </Button>
      </div>

      {showCreate && (
        <Card data-testid="kb-create-form">
          <CardHeader>
            <CardTitle className="text-base">New Knowledge Base</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Roofing FAQ"
                data-testid="kb-name-input"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional description"
                data-testid="kb-description-input"
              />
            </div>
            <Button
              size="sm"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid="kb-create-submit"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
            {createMutation.isError && (
              <p className="text-sm text-red-500" data-testid="kb-create-error">
                Failed to create knowledge base
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-fg" data-testid="kb-loading">
              Loading...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Articles</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map(kb => (
                  <TableRow key={kb.id} data-testid={`kb-row-${kb.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm" data-testid={`kb-name-${kb.id}`}>
                          {kb.name}
                        </p>
                        {kb.description && (
                          <p className="text-xs text-muted-fg">{kb.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={kb.visibilityStatus} />
                    </TableCell>
                    <TableCell
                      className="text-sm text-muted-fg capitalize"
                      data-testid={`kb-content-type-${kb.id}`}
                    >
                      {kb.contentType.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-sm" data-testid={`kb-article-count-${kb.id}`}>
                      <span className="flex items-center gap-1">
                        <BookOpen size={12} className="text-muted-fg" />
                        {kb.articleCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-fg">
                      {formatDate(kb.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link to="/knowledge-bases/$id" params={{ id: kb.id }}>
                          <Button size="sm" variant="ghost" data-testid={`kb-open-${kb.id}`}>
                            Open →
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (
                              confirm(`Delete "${kb.name}"? This will also delete all articles.`)
                            ) {
                              deleteMutation.mutate(kb.id);
                            }
                          }}
                          data-testid={`kb-delete-${kb.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.data.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-fg py-12"
                      data-testid="kb-empty"
                    >
                      No knowledge bases. Create one to get started.
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
          <p className="text-sm text-muted-fg" data-testid="kb-pagination-info">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => p - 1)}
              disabled={page <= 1}
              data-testid="kb-pagination-prev"
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
              data-testid="kb-pagination-next"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "outline"> = {
    published: "default",
    draft: "secondary",
    archived: "outline",
    maintenance: "outline",
  };
  return <Badge variant={variants[status] ?? "outline"}>{status}</Badge>;
}
