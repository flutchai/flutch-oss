import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { Logger } from "@nestjs/common";

const logger = new Logger("ModelFactory");

const DEFAULT_ROUTER_URL = "https://router.flutch.ai";

export interface ModelSettings {
  model: string;
  provider?: "openai" | "anthropic";
  temperature?: number;
  maxTokens?: number;
}

/**
 * Creates a LangChain chat model.
 * Requests are routed through the Flutch gateway by default (https://router.flutch.ai).
 * Override via FLUTCH_ROUTER_URL env var, or set to the provider's native URL to bypass the gateway.
 * API keys are read from OPENAI_API_KEY / ANTHROPIC_API_KEY as usual.
 */
export function createModel(settings: ModelSettings): BaseChatModel {
  const provider = settings.provider ?? inferProvider(settings.model);
  const temperature = settings.temperature ?? 0.7;
  const maxTokens = settings.maxTokens ?? 2048;
  const routerURL = process.env.FLUTCH_ROUTER_URL ?? DEFAULT_ROUTER_URL;

  logger.debug(`Creating model: provider=${provider} model=${settings.model} router=${routerURL}`);

  switch (provider) {
    case "anthropic":
      return new ChatAnthropic({
        modelName: settings.model,
        temperature,
        maxTokens,
        anthropicApiUrl: routerURL,
        streaming: true,
      }) as unknown as BaseChatModel;

    case "openai":
    default:
      return new ChatOpenAI({
        modelName: settings.model,
        temperature,
        maxTokens,
        configuration: { baseURL: `${routerURL}/v1` },
        streaming: true,
      });
  }
}

function inferProvider(model: string): "openai" | "anthropic" {
  if (model.startsWith("claude")) return "anthropic";
  return "openai";
}
