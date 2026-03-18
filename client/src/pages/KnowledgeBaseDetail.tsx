import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
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
import { ChevronLeft, ChevronRight, Plus, X, ArrowLeft, BookOpen } from "lucide-react";

export function KnowledgeBaseDetailPage() {
  const { id: kbId } = useParams({ from: "/knowledge-bases/$id" });
  const [articlesPage, setArticlesPage] = useState(1);
  const [showCreateArticle, setShowCreateArticle] = useState(false);
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
    queryKey: ["kb-articles", kbId, articlesPage],
    queryFn: () => kbApi.listArticles(kbId, { page: articlesPage, limit: 20 }),
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
      setShowCreateArticle(false);
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
      <div className="p-6">
        <div className="py-12 text-center text-sm text-muted-fg" data-testid="kb-detail-loading">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            to="/knowledge-bases"
            className="flex items-center gap-1 text-sm text-muted-fg hover:text-foreground mb-2"
            data-testid="kb-detail-back"
          >
            <ArrowLeft size={14} />
            Knowledge Bases
          </Link>
          <h1 className="text-xl font-semibold" data-testid="kb-detail-heading">
            {kb?.name}
          </h1>
          {kb?.description && <p className="text-sm text-muted-fg">{kb.description}</p>}
        </div>
        <div className="flex gap-2 items-center">
          <Badge
            variant={kb?.visibilityStatus === "published" ? "default" : "secondary"}
            data-testid="kb-detail-status"
          >
            {kb?.visibilityStatus}
          </Badge>
          <Badge variant="outline" data-testid="kb-detail-ownership">
            {kb?.ownership}
          </Badge>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 text-sm text-muted-fg">
        <span className="flex items-center gap-1" data-testid="kb-detail-article-count">
          <BookOpen size={14} />
          {kb?.articleCount ?? 0} articles
        </span>
        <span data-testid="kb-detail-content-type" className="capitalize">
          {kb?.contentType?.replace(/_/g, " ")}
        </span>
        <span data-testid="kb-detail-visibility">{kb?.visibility}</span>
      </div>

      {/* Articles section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium" data-testid="kb-articles-heading">
            Articles
          </h2>
          <Button
            size="sm"
            onClick={() => setShowCreateArticle(s => !s)}
            data-testid="kb-article-create-button"
          >
            {showCreateArticle ? <X size={14} /> : <Plus size={14} />}
            <span className="ml-1">{showCreateArticle ? "Cancel" : "New Article"}</span>
          </Button>
        </div>

        {showCreateArticle && (
          <Card data-testid="kb-article-create-form">
            <CardHeader>
              <CardTitle className="text-sm">New Article</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Title *</label>
                <Input
                  value={articleTitle}
                  onChange={e => setArticleTitle(e.target.value)}
                  placeholder="Article title"
                  data-testid="kb-article-title-input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Content</label>
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={articleContent}
                  onChange={e => setArticleContent(e.target.value)}
                  placeholder="Article content (markdown supported)"
                  data-testid="kb-article-content-input"
                />
              </div>
              <Button
                size="sm"
                disabled={!articleTitle.trim() || createArticleMutation.isPending}
                onClick={() => createArticleMutation.mutate()}
                data-testid="kb-article-create-submit"
              >
                {createArticleMutation.isPending ? "Creating..." : "Create Article"}
              </Button>
              {createArticleMutation.isError && (
                <p className="text-sm text-red-500" data-testid="kb-article-create-error">
                  Failed to create article
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            {articlesLoading ? (
              <div
                className="py-12 text-center text-sm text-muted-fg"
                data-testid="kb-articles-loading"
              >
                Loading...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articlesData?.data.map(article => (
                    <TableRow key={article.id} data-testid={`article-row-${article.id}`}>
                      <TableCell className="font-medium text-sm" data-testid={`article-title-${article.id}`}>
                        {article.title}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={article.isPublished ? "default" : "secondary"}
                          data-testid={`article-status-${article.id}`}
                        >
                          {article.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-sm text-muted-fg capitalize"
                        data-testid={`article-source-${article.id}`}
                      >
                        {article.source ?? "manual"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-fg">
                        {formatDate(article.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPendingToggleId(article.id);
                              togglePublishMutation.mutate({
                                articleId: article.id,
                                isPublished: !article.isPublished,
                              });
                            }}
                            disabled={pendingToggleId === article.id}
                            data-testid={`article-toggle-publish-${article.id}`}
                          >
                            {article.isPublished ? "Unpublish" : "Publish"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm(`Delete article "${article.title}"?`)) {
                                setPendingDeleteId(article.id);
                                deleteArticleMutation.mutate(article.id);
                              }
                            }}
                            disabled={pendingDeleteId === article.id}
                            data-testid={`article-delete-${article.id}`}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {articlesData?.data.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-fg py-12"
                        data-testid="kb-articles-empty"
                      >
                        No articles yet. Create the first one.
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
            <p className="text-sm text-muted-fg" data-testid="articles-pagination-info">
              Page {articlesPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setArticlesPage(p => p - 1)}
                disabled={articlesPage <= 1}
                data-testid="articles-pagination-prev"
              >
                <ChevronLeft size={14} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setArticlesPage(p => p + 1)}
                disabled={articlesPage >= totalPages}
                data-testid="articles-pagination-next"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
