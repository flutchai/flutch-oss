import { Logger } from "@nestjs/common";
import { RunnableConfig } from "@langchain/core/runnables";
import { McpRuntimeHttpClient } from "@flutchai/flutch-sdk";
import { SalesState } from "../sales.annotations";
import { ICrmConfig } from "../sales.types";
import { filterSystemFields, getCrmToolName } from "../crm.constants";

const logger = new Logger("SaveContextNode");

/**
 * Saves updated lead data to CRM after generation.
 *
 * 1. Check if contactData has crmId (existing contact)
 * 2. Filter to writeFields (if configured) or all non-system fields
 * 3. Call CRM update/create tool via mcpClient
 */
export async function saveContextNode(
  state: typeof SalesState.State,
  config: RunnableConfig,
): Promise<Partial<typeof SalesState.State>> {
  const crmConfig: ICrmConfig | undefined =
    (config?.configurable as any)?.crmConfig;
  const mcpClient: McpRuntimeHttpClient | undefined =
    (config?.configurable as any)?.mcpClient;

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

    // Filter to writeFields if configured, otherwise all non-system fields
    let dataToWrite: Record<string, any>;
    if (crmConfig.writeFields && crmConfig.writeFields.length > 0) {
      dataToWrite = {};
      for (const field of crmConfig.writeFields) {
        if (fields[field] !== undefined) {
          dataToWrite[field] = fields[field];
        }
      }
    } else {
      dataToWrite = filterSystemFields(crmConfig.provider, fields);
    }

    if (Object.keys(dataToWrite).length === 0) {
      logger.debug("save_context: no fields to write");
      return {};
    }

    if (crmId) {
      // Update existing contact
      const toolName = getCrmToolName(crmConfig.provider, "update");
      logger.debug(`Updating contact ${crmId} via ${toolName}`);

      await mcpClient.executeTool(toolName, {
        id: crmId,
        ...dataToWrite,
      });

      logger.log(`Updated contact ${crmId} in ${crmConfig.provider}`);
    } else {
      // Create new contact
      const toolName = getCrmToolName(crmConfig.provider, "create");
      logger.debug(`Creating new contact via ${toolName}`);

      const result = await mcpClient.executeTool(toolName, dataToWrite);

      if (result.success && result.result?.id) {
        logger.log(
          `Created contact ${result.result.id} in ${crmConfig.provider}`,
        );
        return {
          contactData: { ...contactData, crmId: result.result.id },
        };
      }
    }
  } catch (error) {
    logger.warn(
      `CRM save failed: ${error instanceof Error ? error.message : error}`,
    );
  }

  return {};
}

