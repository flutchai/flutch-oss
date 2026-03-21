import { Logger } from "@nestjs/common";
import {
  AIMessage,
  BaseMessage,
  SystemMessage,
} from "@langchain/core/messages";
import type { IAgentToolConfig } from "@flutchai/flutch-sdk";
import { SalesState } from "../sales.annotations";
import {
  IContactData,
  ISalesToolConfig,
  SalesRunnableConfig,
} from "../sales.types";

const logger = new Logger("GenerateNode");

/**
 * Invokes the LLM with system prompt + message history.
 * Model is created lazily via ModelInitializer from config.configurable.
 */
export async function generateNode(
  state: typeof SalesState.State,
  config: SalesRunnableConfig,
): Promise<Partial<typeof SalesState.State>> {
  const modelInitializer = config?.configurable?.modelInitializer;

  if (!modelInitializer) {
    throw new Error(
      "GenerateNode: modelInitializer not found in config.configurable",
    );
  }

  const graphSettings = config?.configurable?.graphSettings ?? {};
  const modelId = graphSettings.modelId ?? "gpt-4o-mini";
  const temperature = graphSettings.temperature;
  const maxTokens = graphSettings.maxTokens;
  const toolsConfig = mapAvailableToolsToAgentConfig(
    graphSettings.availableTools,
  );

  // Lazy model creation (cached by ModelInitializer)
  let model = await modelInitializer.initializeChatModel({
    modelId,
    temperature,
    maxTokens,
    toolsConfig,
  });

  // Apply Langfuse tracing callback if available
  const langfuseCallback = config?.configurable?.langfuseCallback;
  if (langfuseCallback) {
    model = (model as any).withConfig({ callbacks: [langfuseCallback] });
  }

  const systemPrompt = config?.configurable?.systemPrompt;

  // Build full system prompt with contact context
  const fullPrompt = buildFullSystemPrompt(systemPrompt, state.contactData);

  const messages: BaseMessage[] = [];
  if (fullPrompt) {
    messages.push(new SystemMessage(fullPrompt));
  }
  messages.push(...state.messages);

  logger.debug(
    `Generating response (${messages.length} messages, model=${modelId})`,
  );

  const response = (await model.invoke(messages, config)) as AIMessage;
  const text = typeof response.content === "string" ? response.content : "";

  return { messages: [response], text };
}

/**
 * Map sales graph availableTools to SDK IAgentToolConfig[].
 * Handles both string[] and ISalesToolConfig[] formats.
 */
function mapAvailableToolsToAgentConfig(
  availableTools?: (string | ISalesToolConfig)[],
): IAgentToolConfig[] | undefined {
  if (!availableTools || availableTools.length === 0) return undefined;

  return availableTools
    .map((tool): IAgentToolConfig | null => {
      if (typeof tool === "string") {
        return { toolName: tool, enabled: true };
      }
      if (!tool?.name) return null;
      return {
        toolName: tool.name,
        enabled: tool.enabled !== false,
        config: tool.config,
      };
    })
    .filter((t): t is IAgentToolConfig => t !== null);
}

/**
 * Append contact context to system prompt if contactData is present.
 */
function buildFullSystemPrompt(
  basePrompt: string | undefined,
  contactData: IContactData | undefined,
): string | undefined {
  if (!basePrompt) return undefined;

  if (!contactData || Object.keys(contactData).length === 0) {
    return basePrompt;
  }

  const { crmId, ...fields } = contactData;
  if (Object.keys(fields).length === 0) return basePrompt;

  const contactLines = Object.entries(fields)
    .filter(([, v]) => v != null && v !== "")
    .map(
      ([k, v]) =>
        `  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`,
    )
    .join("\n");

  if (!contactLines) return basePrompt;

  return `${basePrompt}\n\n── About the customer ──\n${contactLines}`;
}

/**
 * Routing function: check if the generation contains tool calls.
 */
export function shouldUseTools(
  state: typeof SalesState.State,
): "exec_tools" | "save_context" {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCalls = lastMessage?.tool_calls ?? [];
  return toolCalls.length > 0 ? "exec_tools" : "save_context";
}
