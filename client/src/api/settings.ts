import { apiClient } from "./client";

export interface Settings {
  configMode: string;
  flutchPlatformUrl: string | null;
  openaiKeyMasked: string | null;
  anthropicKeyMasked: string | null;
}

export interface WebhookResult {
  success: boolean;
  webhookUrl?: string;
  description?: string;
  error?: string;
}

export const settingsApi = {
  get: () => apiClient.get<Settings>("/settings").then(r => r.data),
  registerWebhook: (agentId: string) =>
    apiClient.post<WebhookResult>(`/settings/telegram/webhook/${agentId}`).then(r => r.data),
};
