import { AIMessage, BaseMessage } from "@langchain/core/messages";

// ── Graph State ──

export interface ILeadProfile {
  contactId?: string;
  name?: string;
  email?: string;
  company?: string;
  metadata?: Record<string, any>;
}

export type TopicStatus = "not_explored" | "partially" | "explored";

export interface ITopicEntry {
  status: TopicStatus;
  details?: string;
}

export interface ISalesGraphState {
  messages: BaseMessage[];
  generation: AIMessage | null;
  systemPrompt: string;
  leadProfile: ILeadProfile;
  topicsMap: Record<string, ITopicEntry>;
  calculatorData?: Record<string, any>;
}

// ── Graph Config (from graphSettings) ──

export interface IQualificationTopic {
  name: string;
  label: string;
  description: string;
  extractionHint: string;
  required: boolean;
}

export interface ISalesToolConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface ISalesGraphSettings {
  prompt: {
    template: string;
    methodology?: string;
    guidelines: string[];
  };
  topics: IQualificationTopic[];
  tools: ISalesToolConfig[];
  extraction: {
    modelId?: string;
    runEvery?: number;
  };
  llm: {
    modelId: string;
    temperature?: number;
    maxTokens?: number;
  };
  crm: {
    provider: string;
  };
}
