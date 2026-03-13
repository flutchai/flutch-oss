import { apiClient } from "./client";

export const dashboardApi = {
  getStats: () => apiClient.get<DashboardStats>("/dashboard/stats").then(r => r.data),
  getStatus: () => apiClient.get<SystemStatus>("/dashboard/status").then(r => r.data),
  getActivity: () => apiClient.get<ActivityItem[]>("/dashboard/activity").then(r => r.data),
};

export interface DashboardStats {
  agents_count: number | null;
  threads_today: number;
  messages_today: number;
  users_total: number;
  total_threads: number;
}

export interface SystemStatus {
  engine: boolean;
  database: boolean;
  ragflow: boolean;
}

export interface ActivityItem {
  id: string;
  threadId: string;
  agentId: string;
  platform: string;
  preview: string;
  createdAt: string;
}
