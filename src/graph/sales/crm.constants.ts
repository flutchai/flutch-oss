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
    if (SYSTEM_FIELDS.has(key)) continue;
    if (value == null || value === "") continue;
    // Filter nested objects that are entirely empty (e.g. { primaryEmail: "" })
    if (typeof value === "object" && !Array.isArray(value)) {
      const nested = filterSystemFields(value);
      if (Object.keys(nested).length > 0) filtered[key] = nested;
      continue;
    }
    filtered[key] = value;
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
    get: "zoho_get_contact",
    create: "zoho_create_contact",
    update: "zoho_update_contact",
    upsert: "zoho_upsert_contact",
  },
  jobber: {
    find: "jobber_list_clients",
    get: "jobber_get_client",
    create: "jobber_create_client",
    update: "jobber_update_client",
    upsert: "jobber_upsert_client",
  },
};

/**
 * Get the CRM MCP tool name for a given provider and action.
 */
export function getCrmToolName(
  provider: string,
  action: "find" | "get" | "create" | "update" | "upsert"
): string | null {
  const mapped = CRM_TOOL_MAP[provider]?.[action];
  if (mapped) return mapped;
  // If the action is not mapped (e.g. Twenty has no upsert), return null
  if (CRM_TOOL_MAP[provider] && !CRM_TOOL_MAP[provider][action]) return null;
  return `${provider}_${action}_contact`;
}

/**
 * Parse MCP tool result — expects standard JSON (object, array, or JSON string).
 * Also handles Twenty-style responses: "Message text\n\n{...json...}"
 */
export function parseMcpResult(result: any): any {
  if (result == null) return null;
  if (typeof result === "object") return result;
  if (typeof result === "string") {
    try {
      return JSON.parse(result);
    } catch {
      // Twenty MCP returns "✅ Message\n\n{json}" — extract JSON after last \n\n
      const parts = result.split("\n\n");
      for (let i = parts.length - 1; i >= 0; i--) {
        try {
          return JSON.parse(parts[i]);
        } catch {
          // continue
        }
      }
      return result;
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

  if (provider === "jobber") {
    // Jobber list_clients uses searchTerm parameter
    return { searchTerm: value, first: 1 };
  }

  // Default: simple key=value
  return { [lookupBy]: value };
}

/**
 * Build arguments for CRM create tool from contact metadata.
 */
/**
 * Resolve first/last name from contact metadata.
 * Handles both `firstName`/`lastName` fields and a combined `name` field.
 */
function resolveNames(contactData: Record<string, any>): { firstName?: string; lastName?: string } {
  if (contactData.firstName || contactData.lastName) {
    return {
      firstName: contactData.firstName,
      lastName: contactData.lastName,
    };
  }
  // Twenty returns name as { firstName, lastName } object
  if (contactData.name && typeof contactData.name === "object") {
    return {
      firstName: contactData.name.firstName,
      lastName: contactData.name.lastName,
    };
  }
  if (typeof contactData.name === "string" && contactData.name) {
    const parts = contactData.name.trim().split(/\s+/);
    return {
      firstName: parts[0],
      lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
    };
  }
  return {};
}

export function buildCreateArgs(
  provider: string,
  contactData: Record<string, any>
): Record<string, any> {
  const { email, phone } = contactData;
  const { firstName, lastName } = resolveNames(contactData);

  if (provider === "twenty") {
    const args: Record<string, any> = {};
    if (firstName) args.firstName = firstName;
    if (lastName) args.lastName = lastName;
    if (email) args.email = email;
    if (phone) args.phone = phone;
    return args;
  }

  if (provider === "jobber") {
    const args: Record<string, any> = {};
    if (firstName) args.firstName = firstName;
    if (lastName) args.lastName = lastName;
    if (email) args.email = email;
    if (phone) args.phone = phone;
    return args;
  }

  if (provider === "zoho") {
    const args: Record<string, any> = {};
    if (firstName) args.First_Name = firstName;
    if (lastName) args.Last_Name = lastName;
    else if (firstName) args.Last_Name = firstName; // Zoho requires Last_Name
    if (email) args.Email = email;
    if (phone) args.Phone = phone;
    return args;
  }

  // Default: pass through
  return { ...contactData };
}
