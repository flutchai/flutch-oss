import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { Logger } from "@nestjs/common";

const logger = new Logger("ModelFactory");

export interface ModelSettings {
  model: string;
  provider?: "openai" | "anthropic";
  temperature?: number;
  maxTokens?: number;
}

/**
 * Creates a LangChain chat model directly from graphSettings.
 * No platform dependency — uses env API keys.
 */
export function createModel(settings: ModelSettings): BaseChatModel {
  const provider = settings.provider ?? inferProvider(settings.model);
  const temperature = settings.temperature ?? 0.7;
  const maxTokens = settings.maxTokens ?? 2048;

  logger.debug(`Creating model: provider=${provider} model=${settings.model}`);

  switch (provider) {
    case "anthropic":
      return new ChatAnthropic({
        modelName: settings.model,
        temperature,
        maxTokens,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        streaming: true,
      }) as unknown as BaseChatModel;

    case "openai":
    default:
      return new ChatOpenAI({
        modelName: settings.model,
        temperature,
        maxTokens,
        openAIApiKey: process.env.OPENAI_API_KEY,
        streaming: true,
      });
  }
}

function inferProvider(model: string): "openai" | "anthropic" {
  if (model.startsWith("claude")) return "anthropic";
  return "openai";
}
