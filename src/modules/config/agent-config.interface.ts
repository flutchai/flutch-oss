export interface AgentConfig {
  agentId: string;
  graphType: string;
  graphSettings: Record<string, any>;
}

export interface ResolvedAgentContext {
  agentId: string;
  userId: string;
  threadId: string;
  graphType: string;
  graphSettings: Record<string, any>;
}
