import { Logger } from "@nestjs/common";
import { RunnableConfig } from "@langchain/core/runnables";
import { SalesState } from "../sales.annotations";
import { ISalesGraphSettings } from "../sales.types";
import { ExtractionService } from "../extraction.service";
import { createModel } from "../../model.factory";

const logger = new Logger("ExtractNode");

const extractionService = new ExtractionService();

// Counter per thread to track message count for runEvery
const messageCounters = new Map<string, number>();

/**
 * Runs structured extraction to update the topics map.
 * Uses a separate (optionally cheaper) LLM call.
 */
export async function extractNode(
  state: typeof SalesState.State,
  config: RunnableConfig,
): Promise<Partial<typeof SalesState.State>> {
  const configurable = config?.configurable as any;
  const graphSettings: ISalesGraphSettings = configurable?.graphSettings;
  const topics = graphSettings?.topics;

  if (!topics?.length) {
    logger.debug("No topics configured, skipping extraction");
    return {};
  }

  // Check runEvery
  const threadId = configurable?.thread_id ?? "default";
  const runEvery = graphSettings.extraction?.runEvery ?? 1;

  const count = (messageCounters.get(threadId) ?? 0) + 1;
  messageCounters.set(threadId, count);

  if (runEvery > 1 && count % runEvery !== 0) {
    logger.debug(`Skipping extraction (message ${count}, runEvery=${runEvery})`);
    return {};
  }

  // Create extraction model (can be cheaper than main model)
  const extractionModelId = graphSettings.extraction?.modelId ?? graphSettings.llm?.modelId ?? "gpt-4o-mini";
  const extractionModel = createModel({
    model: extractionModelId,
    temperature: 0,
    maxTokens: 2048,
  });

  logger.debug(`Running extraction with model=${extractionModelId}`);

  const updatedTopicsMap = await extractionService.extract(
    extractionModel,
    state.messages,
    topics,
    state.topicsMap,
  );

  return { topicsMap: updatedTopicsMap };
}
