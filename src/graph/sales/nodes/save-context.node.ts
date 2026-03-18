import { Logger } from "@nestjs/common";
import { RunnableConfig } from "@langchain/core/runnables";
import { SalesState } from "../sales.annotations";

const logger = new Logger("SaveContextNode");

/**
 * Saves updated lead profile and topics map to CRM.
 *
 * Phase 1: No-op (logs only).
 * Phase 4: Will use CRM tools to persist data.
 */
export async function saveContextNode(
  state: typeof SalesState.State,
  config: RunnableConfig,
): Promise<Partial<typeof SalesState.State>> {
  const configurable = config?.configurable as any;

  logger.debug(
    `Save context: lead=${state.leadProfile?.name ?? "unknown"}, ` +
    `topics=${Object.keys(state.topicsMap).length}, ` +
    `explored=${Object.values(state.topicsMap).filter((t) => t.status === "explored").length}`,
  );

  // TODO Phase 4: CRM save
  // await mcpClient.executeTool("crm_update_contact", {
  //   id: state.leadProfile.contactId,
  //   metadata: {
  //     qualification: state.topicsMap,
  //     calculatorData: state.calculatorData,
  //     lastInteractionAt: new Date().toISOString(),
  //     totalMessages: state.messages.length,
  //   },
  // });

  // Return text for the response payload
  const text =
    typeof state.generation?.content === "string"
      ? state.generation.content
      : "";

  return { generation: state.generation };
}
