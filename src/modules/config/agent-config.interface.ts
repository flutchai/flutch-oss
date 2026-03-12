export interface TelegramPlatformConfig {
  botToken: string;
}

export interface AgentConfig {
  agentId: string;
  graphType: string;
  graphSettings: Record<string, any>;
  platforms?: {
    telegram?: TelegramPlatformConfig;
  };
}

export interface ResolvedAgentContext {
  agentId: string;
  userId: string;
  threadId: string;
  graphType: string;
  graphSettings: Record<string, any>;
}
