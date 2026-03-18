import { apiClient } from "./client";

export const kbApi = {
  // Knowledge Bases
  list: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get("/knowledge-bases", { params })
      .then(r => r.data as PaginatedResponse<KnowledgeBaseItem>),

  get: (id: string) =>
    apiClient.get(`/knowledge-bases/${id}`).then(r => r.data as KnowledgeBaseDetail),

  create: (body: CreateKbRequest) =>
    apiClient.post("/knowledge-bases", body).then(r => r.data as KnowledgeBaseDetail),

  update: (id: string, body: UpdateKbRequest) =>
    apiClient.patch(`/knowledge-bases/${id}`, body).then(r => r.data as KnowledgeBaseDetail),

  delete: (id: string) => apiClient.delete(`/knowledge-bases/${id}`),

  // Articles
  listArticles: (kbId: string, params?: { page?: number; limit?: number }) =>
    apiClient
      .get(`/knowledge-bases/${kbId}/articles`, { params })
      .then(r => r.data as PaginatedResponse<ArticleItem>),

  getArticle: (kbId: string, id: string) =>
    apiClient.get(`/knowledge-bases/${kbId}/articles/${id}`).then(r => r.data as ArticleDetail),

  createArticle: (kbId: string, body: CreateArticleRequest) =>
    apiClient.post(`/knowledge-bases/${kbId}/articles`, body).then(r => r.data as ArticleDetail),

  updateArticle: (kbId: string, id: string, body: UpdateArticleRequest) =>
    apiClient
      .patch(`/knowledge-bases/${kbId}/articles/${id}`, body)
      .then(r => r.data as ArticleDetail),

  deleteArticle: (kbId: string, id: string) =>
    apiClient.delete(`/knowledge-bases/${kbId}/articles/${id}`),
};

export interface KnowledgeBaseItem {
  id: string;
  name: string;
  description?: string;
  ownership: string;
  visibility: string;
  visibilityStatus: string;
  contentType: string;
  articleCount: number;
  createdAt: string;
}

export interface KnowledgeBaseDetail extends KnowledgeBaseItem {
  slug?: string;
  ownerId: string;
  settings: Record<string, any>;
  stats?: { articleCount: number; tagCount: number };
}

export interface ArticleItem {
  id: string;
  title: string;
  isPublished: boolean;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleDetail {
  id: string;
  knowledgeBaseId: string;
  title?: string;
  isPublished: boolean;
  source?: string;
  draftArticle?: { title?: string; content?: string; author?: string };
  publishedArticle?: { title?: string; content?: string; author?: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateKbRequest {
  name: string;
  description?: string;
  ownership?: string;
  visibility?: string;
  contentType?: string;
}

export interface UpdateKbRequest {
  name?: string;
  description?: string;
  visibilityStatus?: string;
}

export interface CreateArticleRequest {
  title: string;
  content?: string;
}

export interface UpdateArticleRequest {
  title?: string;
  content?: string;
  isPublished?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
