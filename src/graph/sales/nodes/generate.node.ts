import { Logger } from "@nestjs/common";
import { RunnableConfig } from "@langchain/core/runnables";
import {
  AIMessage,
  BaseMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { SalesState } from "../sales.annotations";
import { IContactData } from "../sales.types";

const logger = new Logger("GenerateNode");

/**
 * Invokes the LLM with system prompt + message history.
 * Model and systemPrompt are passed via config.configurable.salesModel / systemPrompt.
 */
export async function generateNode(
  state: typeof SalesState.State,
  config: RunnableConfig,
): Promise<Partial<typeof SalesState.State>> {
  const model: BaseChatModel | undefined =
    (config?.configurable as any)?.salesModel;

  if (!model) {
    throw new Error(
      "GenerateNode: salesModel not found in config.configurable",
    );
  }

  const systemPrompt: string | undefined =
    (config?.configurable as any)?.systemPrompt;

  // Build full system prompt with contact context
  const fullPrompt = buildFullSystemPrompt(systemPrompt, state.contactData);

  const messages: BaseMessage[] = [];
  if (fullPrompt) {
    messages.push(new SystemMessage(fullPrompt));
  }
  messages.push(...state.messages);

  logger.debug(`Generating response (${messages.length} messages)`);

  const response = (await model.invoke(messages, config)) as AIMessage;
  const text = typeof response.content === "string" ? response.content : "";

  return { messages: [response], text };
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
    .map(([k, v]) => `  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
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
