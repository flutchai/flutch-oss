import type { ModelConfigFetcher, ModelConfigWithToken } from "@flutchai/flutch-sdk";
import { ModelProvider } from "@flutchai/flutch-sdk";

// Mirror of DEFAULT_ROUTER_URL from node-sdk — used as fallback when
// FLUTCH_API_TOKEN is set but FLUTCH_ROUTER_URL is not explicitly configured.
const DEFAULT_ROUTER_URL = "https://router.flutch.ai";

/**
 * Creates a ModelConfigFetcher for OSS (standalone) mode.
 * Infers provider from model name and uses env API keys.
 * No platform API dependency.
 */
export function createOssConfigFetcher(): ModelConfigFetcher {
  return async (modelId: string): Promise<ModelConfigWithToken> => {
    const provider = inferProvider(modelId);
    return {
      modelId,
      modelName: modelId,
      provider,
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      apiToken: getApiToken(provider),
      requiresApiKey: true,
      // baseURL is set only in gateway mode (FLUTCH_API_TOKEN present).
      // Undefined in standalone mode → ModelInitializer will NOT override the
      // provider's native base URL, so requests go directly to the provider.
      baseURL: getBaseURL(),
    };
  };
}

function inferProvider(modelId: string): ModelProvider {
  if (modelId.startsWith("claude")) return ModelProvider.ANTHROPIC;
  if (modelId.startsWith("mistral") || modelId.startsWith("mixtral")) return ModelProvider.MISTRAL;
  return ModelProvider.OPENAI;
}

function getApiToken(provider: ModelProvider): string | undefined {
  // FLUTCH_API_TOKEN — platform token for Flutch Gateway.
  // When set, the router validates it and injects the real provider key internally.
  // All providers share the same token — that is how the gateway works.
  //
  // When not set — standalone mode: real provider keys are passed directly.
  if (process.env.FLUTCH_API_TOKEN) return process.env.FLUTCH_API_TOKEN;

  switch (provider) {
    case ModelProvider.ANTHROPIC:
      return process.env.ANTHROPIC_API_KEY;
    case ModelProvider.MISTRAL:
      return process.env.MISTRAL_API_KEY;
    default:
      return process.env.OPENAI_API_KEY;
  }
}

/**
 * Returns the gateway base URL only when FLUTCH_API_TOKEN is configured
 * (gateway mode). Returns undefined in standalone mode.
 */
function getBaseURL(): string | undefined {
  if (!process.env.FLUTCH_API_TOKEN) return undefined;
  return process.env.FLUTCH_ROUTER_URL ?? DEFAULT_ROUTER_URL;
}
