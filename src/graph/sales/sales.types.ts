import type { BaseGraphContext, IGraphConfigurable } from "@flutchai/flutch-sdk";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

// ── Graph State ──

export interface IContactData {
  /** CRM record ID. Undefined for new contacts. */
  crmId?: string;
  /** All other fields are dynamic — CRM native structure, no mapping */
  [key: string]: any;
}

// ── Qualification Fields ──

export interface IQualificationField {
  name: string;
  description: string;
  required: boolean;
}

// ── Runtime Config (LangGraph configurable — uses SDK types) ──

/** Sales configurable — extends SDK's IGraphConfigurable */
export interface ISalesConfigurable extends IGraphConfigurable<ISalesGraphSettings> {
  context?: BaseGraphContext;
}

/** Typed config for sales graph nodes */
export type SalesRunnableConfig = LangGraphRunnableConfig<ISalesConfigurable>;

// ── Graph Settings (from DB/admin UI) ──

export interface IConversationSettings {
  systemPrompt?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  /** Number of recent messages to send to the LLM. Defaults to 50. */
  messageWindowSize?: number;
  recursionLimit?: number;
  availableTools?: (string | ISalesToolConfig)[];
}

export interface ICrmSettings extends ICrmConfig {
  /** MCP tools to run for enrichment on first message (async, fire-and-forget). */
  enrichmentTools?: (string | ISalesToolConfig)[];
}

export interface IQualificationSettings {
  /** Fields to collect from the customer. The AI collects them naturally, no fixed order. */
  qualificationFields?: IQualificationField[];
  /** Model ID for the cheap extraction model (extracts qualification data from conversation, writes to CRM). */
  extractionModelId?: string;
  /** CRM contact fields visible to the AI in the system prompt.
   *  Only whitelisted fields are included — all others are hidden.
   *  Defaults: name, firstName, lastName, company, companyName, industry, role, jobTitle */
  contactFieldsWhitelist?: string[];
}

export interface ISafetySettings {
  inputSanitization?: IGuardrailConfig;
}

export interface ISalesGraphSettings {
  conversation?: IConversationSettings;
  crm?: ICrmSettings;
  qualification?: IQualificationSettings;
  safety?: ISafetySettings;
}

export interface ISalesToolConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

/** Input sanitization toggle + model. */
export interface IGuardrailConfig {
  enabled?: boolean;
  modelId?: string;
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

/** Extract per-tool config map from graphSettings.conversation.availableTools */
export function extractToolConfigs(graphSettings?: ISalesGraphSettings): Record<string, any> {
  const raw = graphSettings?.conversation?.availableTools ?? [];
  const result: Record<string, any> = {};
  for (const tool of raw) {
    if (typeof tool !== "string" && tool?.name && tool.config) {
      result[tool.name] = tool.config;
    }
  }
  return result;
}
