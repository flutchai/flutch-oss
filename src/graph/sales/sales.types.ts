import type { BaseGraphContext, IGraphConfigurable } from "@flutchai/flutch-sdk";
import type { ModelConfig } from "@flutchai/flutch-sdk";
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
  model?: ModelConfig;
  systemPrompt?: string;
  /** Number of recent messages to send to the LLM. Defaults to 50. */
  messageWindowSize?: number;
  recursionLimit?: number;
}

export interface ICrmSettings extends ICrmConfig {
  /** Agent ID to call for enrichment on first message (async, fire-and-forget). */
  enrichmentAgent?: string;
  /** Per-provider configs are inherited from ICrmConfig via index signature */
}

export interface IQualificationSettings {
  /** Fields to collect from the customer. The AI collects them naturally, no fixed order. */
  qualificationFields?: IQualificationField[];
  /** Cheap/fast model for extraction (extracts qualification data from conversation, writes to CRM). */
  extractionModel?: ModelConfig;
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

/** Input sanitization toggle + model. */
export interface IGuardrailConfig {
  enabled?: boolean;
  model?: ModelConfig;
}

export type CrmProvider = "twenty" | "zoho" | "jobber";

/** Per-provider CRM config (enabled flag + credentials reference). */
export interface ICrmProviderConfig {
  enabled?: boolean;
  /** String reference to TokenStorage (e.g. "oauth/jobber" or "credentials/..."). Resolved at runtime. */
  _credentials?: string | Record<string, any>;
}

/** CRM config from graphSettings (UI). Each provider is a separate key. */
export interface ICrmConfig {
  /** Field used to look up existing contact */
  lookupBy?: "email" | "phone";
  /** Per-provider configs */
  [provider: string]: ICrmProviderConfig | any;
}

/** Find the first enabled CRM provider in config. */
export function getActiveCrmProvider(
  crm?: ICrmConfig
): { provider: CrmProvider; config: ICrmProviderConfig } | null {
  if (!crm) return null;
  const providers: CrmProvider[] = ["twenty", "zoho", "jobber"];
  for (const p of providers) {
    const cfg = crm[p] as ICrmProviderConfig | undefined;
    if (cfg?.enabled) {
      return { provider: p, config: cfg };
    }
  }
  return null;
}

// ── Utilities ──

/** Extract per-tool config map from model tools config */
export function extractToolConfigs(graphSettings?: ISalesGraphSettings): Record<string, any> {
  const raw = graphSettings?.conversation?.model?.tools ?? [];
  const result: Record<string, any> = {};
  for (const tool of raw) {
    if (typeof tool !== "string" && tool?.name && tool.config) {
      result[tool.name] = tool.config;
    }
  }
  return result;
}
