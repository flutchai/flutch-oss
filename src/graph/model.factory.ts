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
 * Two modes:
 *   Gateway mode (FLUTCH_API_TOKEN is set) —
 *     All requests are routed through Flutch Gateway (FLUTCH_ROUTER_URL, default
 *     https://router.flutch.ai). The router validates FLUTCH_API_TOKEN and injects
 *     the real provider key internally. All providers share the same token.
 *
 *   Standalone mode (FLUTCH_API_TOKEN is NOT set) —
 *     Provider base URLs are NOT overridden; LangChain uses native provider APIs
 *     (api.openai.com, api.anthropic.com, api.mistral.ai). Real provider API keys
 *     are read from OPENAI_API_KEY / ANTHROPIC_API_KEY / MISTRAL_API_KEY.
 */
export function createModel(settings: ModelSettings): BaseChatModel {
  const provider = settings.provider ?? inferProvider(settings.model);
  const temperature = settings.temperature ?? 0.7;
  const maxTokens = settings.maxTokens ?? 2048;

  const platformToken = process.env.FLUTCH_API_TOKEN;

  // Only route through gateway when platform token is configured.
  // Standalone mode: gatewayURL is undefined → provider base URLs are not overridden.
  const gatewayURL = platformToken
    ? (process.env.FLUTCH_ROUTER_URL ?? DEFAULT_ROUTER_URL)
    : undefined;

  logger.debug(
    `Creating model: provider=${provider} model=${settings.model}` +
      (gatewayURL ? ` gateway=${gatewayURL}` : " (standalone)")
  );

  switch (provider) {
    case "anthropic":
      return new ChatAnthropic({
        modelName: settings.model,
        temperature,
        maxTokens,
        // In standalone mode anthropicApiUrl is omitted → api.anthropic.com is used.
        ...(gatewayURL ? { anthropicApiUrl: gatewayURL } : {}),
        // undefined → ChatAnthropic reads ANTHROPIC_API_KEY from env.
        ...(platformToken ? { anthropicApiKey: platformToken } : {}),
        streaming: true,
      }) as unknown as BaseChatModel;

    case "mistral":
      return new ChatMistralAI({
        model: settings.model,
        temperature,
        maxTokens,
        // undefined → ChatMistralAI reads MISTRAL_API_KEY from env.
        ...(platformToken ? { apiKey: platformToken } : {}),
        // Mistral SDK ignores FLUTCH_ROUTER_URL on its own; serverURL must be
        // set explicitly to route through the gateway. In standalone mode it is
        // omitted so Mistral uses api.mistral.ai directly.
        ...(gatewayURL ? { serverURL: `${gatewayURL}/v1` } : {}),
      }) as unknown as BaseChatModel;

    case "openai":
    default:
      return new ChatOpenAI({
        modelName: settings.model,
        temperature,
        maxTokens,
        // In standalone mode configuration is omitted → api.openai.com is used.
        ...(gatewayURL ? { configuration: { baseURL: `${gatewayURL}/v1` } } : {}),
        // undefined → ChatOpenAI reads OPENAI_API_KEY from env.
        ...(platformToken ? { openAIApiKey: platformToken } : {}),
        streaming: true,
      });
  }
}

function inferProvider(model: string): "openai" | "anthropic" | "mistral" {
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("mistral") || model.startsWith("mixtral")) return "mistral";
  return "openai";
}
