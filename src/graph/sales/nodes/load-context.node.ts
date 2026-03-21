import { Logger } from "@nestjs/common";
import { SalesState } from "../sales.annotations";
import { IContactData, SalesRunnableConfig } from "../sales.types";
import {
  filterSystemFields,
  getCrmToolName,
  buildCrmCredentials,
  parseMcpResult,
  buildLookupArgs,
} from "../crm.constants";

const logger = new Logger("LoadContextNode");

/**
 * Loads lead context from CRM before generation.
 *
 * 1. Extract contact identifier from message metadata or context
 * 2. Call CRM find tool via mcpClient
 * 3. Filter system fields, keep raw CRM structure
 * 4. Return contactData for use in generate node
 */
export async function loadContextNode(
  state: typeof SalesState.State,
  config: SalesRunnableConfig,
): Promise<Partial<typeof SalesState.State>> {
  const crmConfig = config?.configurable?.crmConfig;
  const mcpClient = config?.configurable?.mcpClient;

  if (!crmConfig || !mcpClient) {
    logger.debug("load_context: no CRM config or mcpClient, skipping");
    return {};
  }

  const context = config?.configurable?.context;

  // Extract contact lookup value from first message metadata or context
  const lookupValue = extractLookupValue(state, crmConfig.lookupBy, context);

  if (!lookupValue) {
    logger.debug(
      `load_context: no ${crmConfig.lookupBy} found, skipping CRM lookup`,
    );
    return {};
  }

  try {
    const toolName = getCrmToolName(crmConfig.provider, "find");
    const _credentials = buildCrmCredentials(crmConfig);
    const lookupParams = buildLookupArgs(crmConfig.provider, crmConfig.lookupBy, lookupValue);

    logger.debug(
      `Looking up contact by ${crmConfig.lookupBy}=${lookupValue} via ${toolName}`,
    );

    const result = await mcpClient.executeTool(toolName, {
      ...lookupParams,
      ...(_credentials && { _credentials }),
    });

    if (!result.success || !result.result) {
      logger.debug("Contact not found in CRM, using metadata only");
      return {
        contactData: extractContactFromMetadata(state),
      };
    }

    // Parse the result (MCP may return text with embedded JSON)
    const parsed = parseMcpResult(result.result);

    // Extract the first matching contact
    const raw = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!raw || !raw.id) {
      logger.debug("No matching contact in CRM, using metadata only");
      return {
        contactData: extractContactFromMetadata(state),
      };
    }

    // Filter system fields, keep raw CRM structure as-is
    const crmId = raw.id;
    const filtered = filterSystemFields(raw);

    const contactData: IContactData = {
      crmId,
      ...filtered,
    };

    logger.log(`Loaded contact ${crmId} from ${crmConfig.provider}`);

    return { contactData };
  } catch (error) {
    logger.warn(
      `CRM lookup failed: ${error instanceof Error ? error.message : error}`,
    );
    return {
      contactData: extractContactFromMetadata(state),
    };
  }
}

/**
 * Extract the lookup value (email/phone) from message metadata or context.
 */
function extractLookupValue(
  state: typeof SalesState.State,
  lookupBy: string,
  context?: Record<string, any>,
): string | undefined {
  // Try context first (may have userId/email from widget)
  if (context?.[lookupBy]) {
    return context[lookupBy];
  }

  // Try first message metadata
  const firstMsg = state.messages[0];
  const metadata =
    (firstMsg as any)?.additional_kwargs?.metadata ??
    (firstMsg as any)?.kwargs?.additional_kwargs?.metadata;

  if (metadata?.[lookupBy]) {
    return metadata[lookupBy];
  }

  return undefined;
}

/**
 * Extract contact data from the first message metadata (pre-chat form).
 */
function extractContactFromMetadata(
  state: typeof SalesState.State,
): IContactData {
  const firstMsg = state.messages[0];
  const metadata =
    (firstMsg as any)?.additional_kwargs?.metadata ??
    (firstMsg as any)?.kwargs?.additional_kwargs?.metadata;

  if (!metadata) return {};

  const { calculatorData, ...contactFields } = metadata;
  return contactFields;
}
