/**
 * Universal system fields to filter out from any CRM response.
 * Combined blacklist — safe to apply regardless of provider.
 */
export const SYSTEM_FIELDS = new Set([
  // Common
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  // Twenty-specific
  "position",
  "createdBy",
  "updatedBy",
  "__typename",
  "searchVector",
  "avatarUrl",
  // Zoho-specific
  "Created_Time",
  "Modified_Time",
  "Created_By",
  "Modified_By",
  "Owner",
  "$approved",
  "$approval",
  "$editable",
  "$review",
  "$currency_symbol",
  "$converted",
  "$process_flow",
  "$orchestration",
  "$in_merge",
  "$approval_state",
]);

/**
 * Filter out system fields and null/undefined values from CRM data.
 */
export function filterSystemFields(data: Record<string, any>): Record<string, any> {
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!SYSTEM_FIELDS.has(key) && value != null) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * CRM MCP tool name mapping per provider.
 */
const CRM_TOOL_MAP: Record<string, Record<string, string>> = {
  twenty: {
    find: "twenty_list_people",
    get: "twenty_get_person",
    create: "twenty_create_person",
    update: "twenty_update_person",
    upsert: "twenty_upsert_person",
  },
  zoho: {
    find: "zoho_search_contacts",
    create: "zoho_create_contact",
    update: "zoho_update_contact",
    upsert: "zoho_upsert_contact",
  },
};

/**
 * Get the CRM MCP tool name for a given provider and action.
 */
export function getCrmToolName(
  provider: string,
  action: "find" | "get" | "create" | "update" | "upsert"
): string {
  return CRM_TOOL_MAP[provider]?.[action] ?? `${provider}_${action}_contact`;
}

/**
 * Parse MCP tool result which may be a text string containing JSON.
 * MCP servers return text like "Found 8 people\n\n[{...}]" or "✅ Created person: ...\n\n{...}"
 */
export function parseMcpResult(result: any): any {
  if (result == null) return null;

  // Already an object — return as-is
  if (typeof result === "object") return result;

  // Try to extract JSON from text
  if (typeof result === "string") {
    const jsonMatch = result.match(/(\[[\s\S]*\]|\{[\s\S]*\})\s*$/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // Not valid JSON, return as-is
      }
    }
  }

  return result;
}

/**
 * Build lookup arguments for CRM find tool.
 * Twenty uses JSON filter format, others use simple key=value.
 */
export function buildLookupArgs(
  provider: string,
  lookupBy: string,
  value: string
): Record<string, any> {
  if (provider === "twenty") {
    // Twenty needs nested filter: {"emails": {"primaryEmail": {"eq": "value"}}}
    const FIELD_TO_FILTER: Record<string, string> = {
      email: "emails.primaryEmail",
      phone: "phones.primaryPhoneNumber",
    };

    const filterPath = FIELD_TO_FILTER[lookupBy] || lookupBy;
    const parts = filterPath.split(".");

    let filter: any = { eq: value };
    for (let i = parts.length - 1; i >= 0; i--) {
      filter = { [parts[i]]: filter };
    }

    return { filter: JSON.stringify(filter), limit: 1 };
  }

  // Default: simple key=value
  return { [lookupBy]: value };
}
