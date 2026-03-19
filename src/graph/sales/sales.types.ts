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

export interface ICrmConfig {
  /** CRM provider — determines system field blacklist */
  provider: "twenty" | "zoho";
  /** Field used to look up existing contact */
  lookupBy: "email" | "phone";
  /** Fields to write back to CRM on save. If empty, writes all non-blacklisted. */
  writeFields?: string[];
}
