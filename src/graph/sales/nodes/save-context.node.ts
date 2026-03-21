import { Logger } from "@nestjs/common";
import { SalesState } from "../sales.annotations";
import { SalesRunnableConfig } from "../sales.types";
import { filterSystemFields, getCrmToolName, buildCrmCredentials, parseMcpResult } from "../crm.constants";

const logger = new Logger("SaveContextNode");

/**
 * Saves updated lead data to CRM after generation.
 *
 * 1. Check if contactData has crmId (existing contact)
 * 2. Filter system fields
 * 3. Call CRM update/create tool via mcpClient
 */
export async function saveContextNode(
  state: typeof SalesState.State,
  config: SalesRunnableConfig,
): Promise<Partial<typeof SalesState.State>> {
  const crmConfig = config?.configurable?.crmConfig;
  const mcpClient = config?.configurable?.mcpClient;

  if (!crmConfig || !mcpClient) {
    logger.debug("save_context: no CRM config or mcpClient, skipping");
    return {};
  }

  const contactData = state.contactData;
  if (!contactData || Object.keys(contactData).length === 0) {
    logger.debug("save_context: no contactData to save");
    return {};
  }

  try {
    // Separate crmId from the rest
    const { crmId, ...fields } = contactData;

    const dataToWrite = filterSystemFields(fields);

    if (Object.keys(dataToWrite).length === 0) {
      logger.debug("save_context: no fields to write");
      return {};
    }

    const _credentials = buildCrmCredentials(crmConfig);

    if (crmId) {
      // Update existing contact
      const toolName = getCrmToolName(crmConfig.provider, "update");
      logger.debug(`Updating contact ${crmId} via ${toolName}`);

      await mcpClient.executeTool(toolName, {
        id: crmId,
        ...dataToWrite,
        ...(_credentials && { _credentials }),
      });

      logger.log(`Updated contact ${crmId} in ${crmConfig.provider}`);
    } else {
      // Create new contact
      const toolName = getCrmToolName(crmConfig.provider, "create");
      logger.debug(`Creating new contact via ${toolName}`);

      const result = await mcpClient.executeTool(toolName, {
        ...dataToWrite,
        ...(_credentials && { _credentials }),
      });

      if (result.success && result.result) {
        const parsed = parseMcpResult(result.result);
        const newId = parsed?.id;
        if (newId) {
          logger.log(
            `Created contact ${newId} in ${crmConfig.provider}`,
          );
          return {
            contactData: { ...contactData, crmId: newId },
          };
        }
      }
    }
  } catch (error) {
    logger.warn(
      `CRM save failed: ${error instanceof Error ? error.message : error}`,
    );
  }

  return {};
}
