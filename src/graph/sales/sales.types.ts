// ── Graph State ──

export interface IContactData {
  /** CRM record ID. Undefined for new contacts. */
  crmId?: string;
  /** All other fields are dynamic — CRM native structure, no mapping */
  [key: string]: any;
}

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

/** CRM config from graphSettings (UI). Provider comes from env. */
export interface ICrmConfig {
  /** Field used to look up existing contact */
  lookupBy: "email" | "phone";
  /** Fields to write back to CRM on save. If empty, writes all non-blacklisted. */
  writeFields?: string[];
}

export type CrmProvider = "twenty" | "zoho";

/** Runtime CRM config passed to nodes (ICrmConfig + provider from env) */
export interface ICrmRuntimeConfig extends ICrmConfig {
  provider: CrmProvider;
}
