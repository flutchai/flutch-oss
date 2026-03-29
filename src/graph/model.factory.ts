import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatMistralAI } from "@langchain/mistralai";
import { Logger } from "@nestjs/common";

const logger = new Logger("ModelFactory");

const DEFAULT_ROUTER_URL = "https://router.flutch.ai";

export interface ModelSettings {
  model: string;
  provider?: "openai" | "anthropic" | "mistral";
  temperature?: number;
  maxTokens?: number;
}

/**
 * Creates a LangChain chat model.
 *
 * Token resolution order:
 *   1. FLUTCH_API_TOKEN — platform token for Flutch Gateway. Used when
 *      FLUTCH_ROUTER_URL points to the Flutch router (https://router.flutch.ai).
 *      The router validates the token and injects the real provider key internally.
 *   2. OPENAI_API_KEY / ANTHROPIC_API_KEY / MISTRAL_API_KEY — real provider keys.
 *      Used in standalone mode when FLUTCH_ROUTER_URL points to the provider's
 *      native URL (or is not set at all).
 *
 * Router URL: env FLUTCH_ROUTER_URL (default: https://router.flutch.ai).
 */
export function createModel(settings: ModelSettings): BaseChatModel {
  const provider = settings.provider ?? inferProvider(settings.model);
  const temperature = settings.temperature ?? 0.7;
  const maxTokens = settings.maxTokens ?? 2048;
  const routerURL = process.env.FLUTCH_ROUTER_URL ?? DEFAULT_ROUTER_URL;

  // When FLUTCH_API_TOKEN is set — use it as auth for the gateway.
  // When not set — pass undefined; LangChain will pick up the standard provider
  // env vars (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.) on its own.
  const platformToken = process.env.FLUTCH_API_TOKEN;

  logger.debug(`Creating model: provider=${provider} model=${settings.model} router=${routerURL}`);

  switch (provider) {
    case "anthropic":
      return new ChatAnthropic({
        modelName: settings.model,
        temperature,
        maxTokens,
        anthropicApiUrl: routerURL,
        anthropicApiKey: platformToken,
        streaming: true,
      }) as unknown as BaseChatModel;

    case "mistral":
      return new ChatMistralAI({
        model: settings.model,
        temperature,
        maxTokens,
        apiKey: platformToken,
        // Mistral requires an explicit serverURL — without it the SDK ignores
        // FLUTCH_ROUTER_URL and always hits api.mistral.ai directly.
        serverURL: `${routerURL}/v1`,
      }) as unknown as BaseChatModel;

    case "openai":
    default:
      return new ChatOpenAI({
        modelName: settings.model,
        temperature,
        maxTokens,
        configuration: { baseURL: `${routerURL}/v1` },
        openAIApiKey: platformToken,
        streaming: true,
      });
  }
}

function inferProvider(model: string): "openai" | "anthropic" | "mistral" {
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("mistral") || model.startsWith("mixtral")) return "mistral";
  return "openai";
}
