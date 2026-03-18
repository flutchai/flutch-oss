import { Logger } from "@nestjs/common";
import { RunnableConfig } from "@langchain/core/runnables";
import { SalesState } from "../sales.annotations";
import { ISalesGraphSettings } from "../sales.types";
import { PromptBuilderService } from "../prompt-builder.service";

const logger = new Logger("BuildPromptNode");

const promptBuilder = new PromptBuilderService();

/**
 * Assembles the system prompt from config template + lead data + topics map.
 */
export async function buildPromptNode(
  state: typeof SalesState.State,
  config: RunnableConfig,
): Promise<Partial<typeof SalesState.State>> {
  const configurable = config?.configurable as any;
  const graphSettings: ISalesGraphSettings = configurable?.graphSettings;

  if (!graphSettings?.prompt?.template) {
    logger.warn("No prompt template in graphSettings, using empty system prompt");
    return { systemPrompt: "" };
  }

  const systemPrompt = promptBuilder.build(
    graphSettings,
    state.leadProfile,
    state.topicsMap,
    state.calculatorData,
  );

  logger.debug(`Built system prompt (${systemPrompt.length} chars)`);

  return { systemPrompt };
}
