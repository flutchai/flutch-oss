export interface TelegramPlatformConfig {
  botToken: string;
}

export interface WidgetPlatformConfig {
  widgetKey: string;
}

export interface AgentConfig {
  agentId: string;
  graphType: string;
  graphSettings: Record<string, any>;
  platforms?: {
    telegram?: TelegramPlatformConfig;
    widget?: WidgetPlatformConfig;
  };
}

export interface ResolvedAgentContext {
  agentId: string;
  userId: string;
  threadId: string;
  graphType: string;
  graphSettings: Record<string, any>;
}
