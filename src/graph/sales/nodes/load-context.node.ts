import { Logger } from "@nestjs/common";
import { RunnableConfig } from "@langchain/core/runnables";
import { HumanMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";
import { ILeadProfile, ITopicEntry, ISalesGraphSettings } from "../sales.types";

const logger = new Logger("LoadContextNode");

/**
 * Loads lead context from CRM or initializes from first message metadata.
 *
 * Phase 1: Extracts data from first message metadata (calculatorData, name, email).
 * Phase 4 (future): Will use CRM tools to fetch/create contacts.
 */
export async function loadContextNode(
  state: typeof SalesState.State,
  config: RunnableConfig,
): Promise<Partial<typeof SalesState.State>> {
  const configurable = config?.configurable as any;
  const graphSettings: ISalesGraphSettings = configurable?.graphSettings ?? {};
  const topics = graphSettings.topics ?? [];

  // Initialize empty topicsMap from config
  const topicsMap: Record<string, ITopicEntry> = {};
  for (const topic of topics) {
    topicsMap[topic.name] = { status: "not_explored" };
  }

  // Extract metadata from first message
  const firstMessage = state.messages[0];
  let leadProfile: ILeadProfile = {};
  let calculatorData: Record<string, any> | undefined;

  if (firstMessage instanceof HumanMessage) {
    const metadata = (firstMessage as any).additional_kwargs?.metadata ?? {};

    leadProfile = {
      name: metadata.name,
      email: metadata.email,
      company: metadata.company,
    };

    if (metadata.calculatorData) {
      calculatorData = metadata.calculatorData;
    }

    logger.debug(
      `Loaded lead profile: name=${leadProfile.name ?? "unknown"}, ` +
      `calculator=${calculatorData ? "yes" : "no"}`,
    );
  }

  // TODO Phase 4: CRM lookup
  // const crmContact = await crmTool.getContact({ userId, agentId });
  // if (crmContact) { merge leadProfile, topicsMap, calculatorData from CRM }
  // else { create contact in CRM }

  return {
    leadProfile,
    topicsMap,
    calculatorData,
  };
}
