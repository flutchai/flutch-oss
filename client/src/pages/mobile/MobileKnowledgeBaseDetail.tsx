import { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, X, BookOpen } from "lucide-react";
import { kbApi } from "@/api/knowledgeBase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";

export function MobileKnowledgeBaseDetail() {
  const { id: kbId } = useParams({ from: "/m/knowledge-bases/$id" });
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [articleTitle, setArticleTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: kb, isLoading: kbLoading } = useQuery({
    queryKey: ["knowledge-base", kbId],
    queryFn: () => kbApi.get(kbId),
  });

  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ["kb-articles", kbId, page],
    queryFn: () => kbApi.listArticles(kbId, { page, limit: 15 }),
    enabled: !!kbId,
  });

  const createArticleMutation = useMutation({
    mutationFn: () =>
      kbApi.createArticle(kbId, {
        title: articleTitle.trim(),
        content: articleContent.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-articles", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", kbId] });
      setShowCreate(false);
      setArticleTitle("");
      setArticleContent("");
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ articleId, isPublished }: { articleId: string; isPublished: boolean }) =>
      kbApi.updateArticle(kbId, articleId, { isPublished }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kb-articles", kbId] }),
    onSettled: () => setPendingToggleId(null),
  });

  const deleteArticleMutation = useMutation({
    mutationFn: (articleId: string) => kbApi.deleteArticle(kbId, articleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-articles", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", kbId] });
    },
    onSettled: () => setPendingDeleteId(null),
  });

  const totalPages = articlesData ? Math.ceil(articlesData.total / articlesData.limit) : 1;

  if (kbLoading) {
    return (
      <div className="p-4 text-sm text-muted-fg" data-testid="mobile-kb-detail-loading">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center gap-3 z-10">
        <Link to="/m/knowledge-bases" data-testid="mobile-kb-detail-back">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" data-testid="mobile-kb-detail-heading">
            {kb?.name}
          </p>
          <div className="flex items-center gap-2">
            <Badge
              variant={kb?.visibilityStatus === "published" ? "default" : "secondary"}
              className="text-[10px]"
              data-testid="mobile-kb-detail-status"
            >
              {kb?.visibilityStatus}
            </Badge>
            <span className="text-xs text-muted-fg" data-testid="mobile-kb-detail-article-count">
              <BookOpen size={11} className="inline mr-0.5" />
              {kb?.articleCount ?? 0} articles
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreate(s => !s)}
          data-testid="mobile-kb-article-create-button"
        >
          {showCreate ? <X size={14} /> : <Plus size={14} />}
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {/* Create article form */}
        {showCreate && (
          <Card data-testid="mobile-kb-article-create-form">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">New Article</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                value={articleTitle}
                onChange={e => setArticleTitle(e.target.value)}
                placeholder="Title *"
                data-testid="mobile-kb-article-title-input"
              />
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={articleContent}
                onChange={e => setArticleContent(e.target.value)}
                placeholder="Content (optional)"
                data-testid="mobile-kb-article-content-input"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!articleTitle.trim() || createArticleMutation.isPending}
                onClick={() => createArticleMutation.mutate()}
                data-testid="mobile-kb-article-create-submit"
              >
                {createArticleMutation.isPending ? "Creating..." : "Create Article"}
              </Button>
              {createArticleMutation.isError && (
                <p className="text-sm text-red-500" data-testid="mobile-kb-article-create-error">
                  Failed to create article
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Articles list */}
        {articlesLoading ? (
          <div data-testid="mobile-kb-articles-loading" className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border p-4 animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <div data-testid="mobile-kb-articles-list" className="space-y-3">
            {articlesData?.data.length === 0 && (
              <div
                data-testid="mobile-kb-articles-empty"
                className="py-12 text-center text-sm text-muted-fg"
              >
                No articles yet
              </div>
            )}
            {articlesData?.data.map(article => (
              <div
                key={article.id}
                className="bg-card rounded-lg border p-4"
                data-testid={`mobile-article-card-${article.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="font-medium text-sm flex-1 mr-2" data-testid={`mobile-article-title-${article.id}`}>
                    {article.title}
                  </p>
                  <Badge
                    variant={article.isPublished ? "default" : "secondary"}
                    className="text-[10px] shrink-0"
                    data-testid={`mobile-article-status-${article.id}`}
                  >
                    {article.isPublished ? "Published" : "Draft"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-fg mb-3">{relativeTime(article.updatedAt)}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={pendingToggleId === article.id}
                    onClick={() => {
                      setPendingToggleId(article.id);
                      togglePublishMutation.mutate({
                        articleId: article.id,
                        isPublished: !article.isPublished,
                      });
                    }}
                    data-testid={`mobile-article-toggle-publish-${article.id}`}
                  >
                    {article.isPublished ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingDeleteId === article.id}
                    onClick={() => {
                      if (confirm(`Delete "${article.title}"?`)) {
                        setPendingDeleteId(article.id);
                        deleteArticleMutation.mutate(article.id);
                      }
                    }}
                    data-testid={`mobile-article-delete-${article.id}`}
                  >
                    Delete
                  </Button>
                </div>
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
              data-testid="mobile-articles-pagination-prev"
            >
              ← Prev
            </Button>
            <span className="text-sm text-muted-fg" data-testid="mobile-articles-pagination-info">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
              data-testid="mobile-articles-pagination-next"
            >
              Next →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
