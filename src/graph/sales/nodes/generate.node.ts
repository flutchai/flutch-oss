import { Logger } from "@nestjs/common";
import { RunnableConfig } from "@langchain/core/runnables";
import { AIMessage, BaseMessage, SystemMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { SalesState } from "../sales.annotations";

const logger = new Logger("GenerateNode");

/**
 * Invokes the LLM with system prompt + message history.
 * Model is passed via config by the builder.
 */
export async function generateNode(
  state: typeof SalesState.State,
  config: RunnableConfig,
): Promise<Partial<typeof SalesState.State>> {
  const model: BaseChatModel | undefined = (config?.configurable as any)?.__salesModel;

  if (!model) {
    throw new Error("GenerateNode: __salesModel not found in config.configurable");
  }

  const messages: BaseMessage[] = [];
  if (state.systemPrompt) {
    messages.push(new SystemMessage(state.systemPrompt));
  }
  messages.push(...state.messages);

  logger.debug(`Generating response (${messages.length} messages)`);

  const response = (await model.invoke(messages, config)) as AIMessage;

  return {
    generation: response,
    messages: [response],
  };
}

/**
 * Routing function: check if the generation contains tool calls.
 */
export function shouldUseTools(state: typeof SalesState.State): "exec_tools" | "extract" {
  const generation = state.generation;
  if (!generation) return "extract";

  const toolCalls = generation.tool_calls ?? [];
  return toolCalls.length > 0 ? "exec_tools" : "extract";
}
