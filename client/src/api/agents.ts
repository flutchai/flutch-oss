import { apiClient } from "./client";

export const agentsApi = {
  list: () => apiClient.get<Agent[]>("/agents").then(r => r.data),
};

export interface Agent {
  id: string;
  graphType: string;
  graphSettings: {
    model?: string;
    systemPrompt?: string;
    temperature?: number;
  };
  platforms: {
    telegram?: { configured: boolean; botTokenMasked: string } | null;
    widget?: { configured: boolean; widgetKey: string } | null;
  };
}
