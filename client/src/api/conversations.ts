import { apiClient } from "./client";
import { type UserIdentity } from "./users";

export const conversationsApi = {
  list: (params?: { agentId?: string; platform?: string; page?: number; limit?: number }) =>
    apiClient.get("/conversations", { params }).then(r => r.data as PaginatedResponse<Thread>),

  getThread: (id: string) =>
    apiClient.get(`/conversations/${id}`).then(r => r.data as ThreadDetail),
};

export interface Thread {
  id: string;
  agentId: string;
  platform: string;
  userId: string;
  messageCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  content: string;
  direction: "incoming" | "outgoing";
  createdAt: string;
}

export interface ThreadDetail {
  id: string;
  agentId: string;
  platform: string;
  user: { id: string; identities: UserIdentity[]; createdAt: string; updatedAt: string };
  createdAt: string;
  messages: Message[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
