import type { McpRuntimeHttpClient, ModelInitializer } from "@flutchai/flutch-sdk";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

// ── Graph State ──

export interface IContactData {
  /** CRM record ID. Undefined for new contacts. */
  crmId?: string;
  /** All other fields are dynamic — CRM native structure, no mapping */
  [key: string]: any;
}

// ── Runtime Configurable (injected by builder into config.configurable) ──

export interface ISalesConfigurable {
  /** ModelInitializer for lazy model creation in generate node */
  modelInitializer?: ModelInitializer;
  /** MCP Runtime client for tool execution */
  mcpClient?: McpRuntimeHttpClient;
  /** Per-tool config from graphSettings */
  toolConfigs?: Record<string, any>;
  /** System prompt built from graphSettings */
  systemPrompt?: string;
  /** Langfuse callback handler (created by builder, applied by generate node) */
  langfuseCallback?: any;
  /** CRM config (merged from graphSettings + env provider) */
  crmConfig?: ICrmRuntimeConfig;
  /** Runtime context from caller (userId, agentId, threadId, etc.) */
  context?: {
    userId?: string;
    agentId?: string;
    threadId?: string;
    messageId?: string;
    platform?: string;
    companyId?: string;
    email?: string;
    phone?: string;
    [key: string]: any;
  };
  /** LangGraph thread ID */
  thread_id?: string;
  /** Graph settings from DB/payload */
  graphSettings?: ISalesGraphSettings;
}

/** Typed config for sales graph nodes */
export type SalesRunnableConfig = LangGraphRunnableConfig<ISalesConfigurable>;

// ── Graph Config (from graphSettings) ──

export interface ISalesGraphSettings {
  systemPrompt?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  availableTools?: (string | ISalesToolConfig)[];
  recursionLimit?: number;
  crm?: ICrmConfig;
}

export interface ISalesToolConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export type CrmProvider = "twenty" | "zoho";

/** CRM config from graphSettings (UI). */
export interface ICrmConfig {
  /** CRM provider */
  provider: CrmProvider;
  /** Field used to look up existing contact */
  lookupBy: "email" | "phone";
  /** CRM API key. Passed as _credentials to MCP Runtime for dynamic server spawning. */
  apiKey?: string;
  /** CRM base URL. Passed as _credentials to MCP Runtime. */
  baseUrl?: string;
}

/** Runtime CRM config passed to nodes. Same as ICrmConfig — kept for clarity. */
export type ICrmRuntimeConfig = ICrmConfig;
