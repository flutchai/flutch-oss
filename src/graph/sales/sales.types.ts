import type { BaseGraphContext, IGraphConfigurable } from "@flutchai/flutch-sdk";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

// ── Graph State ──

export interface IContactData {
  /** CRM record ID. Undefined for new contacts. */
  crmId?: string;
  /** All other fields are dynamic — CRM native structure, no mapping */
  [key: string]: any;
}

// ── Qualification Steps ──

export interface IStepField {
  name: string;
  description: string;
  required: boolean;
}

export interface IStepConfig {
  id: string;
  name: string;
  prompt: string;
  fields: IStepField[];
  /** MCP tool names available in this step. Empty = no step-specific tools. */
  tools: string[];
}

export type QualificationOutcome = "qualified" | "nurture" | "disqualified";

export interface ILeadScore {
  score: number;
  outcome: QualificationOutcome;
  reasons: string[];
  scoredAt: string;
}

export type QualificationPreset = "b2b_bant" | "b2c_service" | "custom";

// ── Runtime Config (LangGraph configurable — uses SDK types) ──

/** Sales-specific context extends SDK's BaseGraphContext with lookup fields */
export interface ISalesContext extends BaseGraphContext {
  email?: string;
  phone?: string;
}

/** Sales configurable — extends SDK's IGraphConfigurable */
export interface ISalesConfigurable extends IGraphConfigurable<ISalesGraphSettings> {
  context?: ISalesContext;
}

/** Typed config for sales graph nodes */
export type SalesRunnableConfig = LangGraphRunnableConfig<ISalesConfigurable>;

// ── Graph Settings (from DB/admin UI) ──

export interface ISalesGraphSettings {
  systemPrompt?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  availableTools?: (string | ISalesToolConfig)[];
  recursionLimit?: number;
  crm?: ICrmConfig;
  /** Qualification preset — determines default steps */
  preset?: QualificationPreset;
  /** Qualification steps (from preset or custom) */
  steps?: IStepConfig[];
  /** MCP tools to run for enrichment on first message (async, fire-and-forget).
   *  Accepts same format as availableTools — string names or {name, enabled, config} objects. */
  enrichmentTools?: (string | ISalesToolConfig)[];
  /** Auto-handoff qualified leads (true) or wait for human approval (false) */
  autoHandoff?: boolean;
  /** Webhook URL for qualified lead handoff */
  handoffWebhookUrl?: string;
}

export interface ISalesToolConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export type CrmProvider = "twenty" | "zoho" | "jobber";

/** CRM config from graphSettings (UI). */
export interface ICrmConfig {
  /** CRM provider */
  provider: CrmProvider;
  /** Field used to look up existing contact */
  lookupBy: "email" | "phone";
}

// ── Utilities ──

/** Extract per-tool config map from graphSettings.availableTools */
export function extractToolConfigs(graphSettings?: ISalesGraphSettings): Record<string, any> {
  const raw = graphSettings?.availableTools ?? [];
  const result: Record<string, any> = {};
  for (const tool of raw) {
    if (typeof tool !== "string" && tool?.name && tool.config) {
      result[tool.name] = tool.config;
    }
  }
  return result;
}
