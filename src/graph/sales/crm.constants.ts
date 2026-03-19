/**
 * System fields to filter out when loading contact data from CRM.
 * These are internal CRM fields not useful for the sales agent.
 */
export const CRM_SYSTEM_FIELDS: Record<string, Set<string>> = {
  twenty: new Set([
    "id",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "position",
    "createdBy",
    "updatedBy",
    "__typename",
    "searchVector",
    "avatarUrl",
  ]),
  zoho: new Set([
    "id",
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
  ]),
};

/**
 * Filter out system fields from CRM contact data.
 */
export function filterSystemFields(
  provider: string,
  data: Record<string, any>,
): Record<string, any> {
  const blacklist = CRM_SYSTEM_FIELDS[provider];
  if (!blacklist) return data;

  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!blacklist.has(key) && value != null) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * CRM MCP tool name mapping per provider.
 * These names must match the tools exposed by the CRM MCP servers.
 */
const CRM_TOOL_MAP: Record<string, Record<string, string>> = {
  twenty: {
    find: "twenty_find_person",
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
  action: "find" | "create" | "update" | "upsert",
): string {
  return CRM_TOOL_MAP[provider]?.[action] ?? `${provider}_${action}_contact`;
}
