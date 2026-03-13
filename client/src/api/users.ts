import { apiClient } from "./client";

export interface UserIdentity {
  platform: string;
  externalId: string;
  metadata?: { username?: string; [key: string]: unknown };
}

export interface User {
  id: string;
  identities: UserIdentity[];
  createdAt: string;
  updatedAt: string;
}

export interface UserDetail extends User {
  threads: { id: string; agentId: string; platform: string; createdAt: string }[];
}

export interface PaginatedUsers {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

export const usersApi = {
  list: (params?: { page?: number; limit?: number }) =>
    apiClient.get<PaginatedUsers>("/users", { params }).then(r => r.data),

  getUser: (id: string) => apiClient.get<UserDetail>(`/users/${id}`).then(r => r.data),

  mergeUsers: (sourceId: string, targetId: string) =>
    apiClient.post<{ success: boolean }>("/users/merge", { sourceId, targetId }).then(r => r.data),
};
