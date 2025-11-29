import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import type { BYOKProvider } from "../db/schema";
import { isTestEnvironment } from "../constants";

// =============================================================================
// BYOK Provider Configuration
// =============================================================================
// We support three providers for BYOK:
// 1. Moonshot/Kimi - Great value, long context, Chinese market leader
// 2. Google Gemini - Popular, good pricing, strong reasoning
// 3. Anthropic Claude - Premium quality, best for complex tasks
//
// NOTE: We explicitly do NOT support OpenAI due to concerns about their
// API usage tracking practices and history of competitive behavior.
// =============================================================================

// Platform's default Kimi provider (OpenAI-compatible)
// Moonshot API requires full /v1 path in baseURL
const platformKimi = createOpenAI({
  baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
  apiKey: process.env.KIMI_API_KEY,
});

/**
 * Create a Kimi/Moonshot provider with a custom API key
 */
export function createKimiProvider(apiKey: string) {
  return createOpenAI({
    baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
    apiKey,
  });
}

/**
 * Create a Google Gemini provider with a custom API key
 */
export function createGeminiProvider(apiKey: string) {
  return createGoogleGenerativeAI({
    apiKey,
  });
}

/**
 * Create an Anthropic provider with a custom API key
 */
export function createAnthropicProvider(apiKey: string) {
  return createAnthropic({
    apiKey,
  });
}

// Model mappings for each provider
const PROVIDER_MODELS = {
  kimi: {
    chat: "kimi-k2-turbo-preview",
    reasoning: "kimi-k2-turbo-preview",
    title: "kimi-k2-turbo-preview",
    artifact: "kimi-k2-turbo-preview",
  },
  gemini: {
    chat: "gemini-3-pro-preview",
    reasoning: "gemini-3-pro-preview",
    title: "gemini-2.5-flash",
    artifact: "gemini-2.5-flash",
  },
  anthropic: {
    chat: "claude-sonnet-4-5-20250929",
    reasoning: "claude-opus-4-5-20250929",
    title: "claude-sonnet-4-5-20250929",
    artifact: "claude-sonnet-4-5-20250929",
  },
} as const;

/**
 * BYOK configuration for a user
 */
export type BYOKConfig = {
  provider: BYOKProvider;
  apiKey: string;
};

/**
 * Get provider for a user based on their BYOK settings.
 * Supports Kimi, Gemini, and Anthropic.
 */
export function getProviderForUser(byokConfig?: BYOKConfig) {
  // No BYOK config - use platform's default (Kimi)
  if (!byokConfig) {
    return customProvider({
      languageModels: {
        "chat-model": platformKimi.chat(PROVIDER_MODELS.kimi.chat),
        "chat-model-reasoning": wrapLanguageModel({
          model: platformKimi.chat(PROVIDER_MODELS.kimi.reasoning),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": platformKimi.chat(PROVIDER_MODELS.kimi.title),
        "artifact-model": platformKimi.chat(PROVIDER_MODELS.kimi.artifact),
      },
    });
  }

  const { provider, apiKey } = byokConfig;

  switch (provider) {
    case "kimi": {
      const kimi = createKimiProvider(apiKey);
      return customProvider({
        languageModels: {
          "chat-model": kimi.chat(PROVIDER_MODELS.kimi.chat),
          "chat-model-reasoning": wrapLanguageModel({
            model: kimi.chat(PROVIDER_MODELS.kimi.reasoning),
            middleware: extractReasoningMiddleware({ tagName: "think" }),
          }),
          "title-model": kimi.chat(PROVIDER_MODELS.kimi.title),
          "artifact-model": kimi.chat(PROVIDER_MODELS.kimi.artifact),
        },
      });
    }

    case "gemini": {
      const gemini = createGeminiProvider(apiKey);
      return customProvider({
        languageModels: {
          "chat-model": gemini(PROVIDER_MODELS.gemini.chat),
          "chat-model-reasoning": wrapLanguageModel({
            model: gemini(PROVIDER_MODELS.gemini.reasoning),
            middleware: extractReasoningMiddleware({ tagName: "thinking" }),
          }),
          "title-model": gemini(PROVIDER_MODELS.gemini.title),
          "artifact-model": gemini(PROVIDER_MODELS.gemini.artifact),
        },
      });
    }

    case "anthropic": {
      const anthropic = createAnthropicProvider(apiKey);
      return customProvider({
        languageModels: {
          "chat-model": anthropic(PROVIDER_MODELS.anthropic.chat),
          "chat-model-reasoning": wrapLanguageModel({
            model: anthropic(PROVIDER_MODELS.anthropic.reasoning),
            middleware: extractReasoningMiddleware({ tagName: "thinking" }),
          }),
          "title-model": anthropic(PROVIDER_MODELS.anthropic.title),
          "artifact-model": anthropic(PROVIDER_MODELS.anthropic.artifact),
        },
      });
    }

    default:
      // Fallback to platform default
      return customProvider({
        languageModels: {
          "chat-model": platformKimi.chat(PROVIDER_MODELS.kimi.chat),
          "chat-model-reasoning": wrapLanguageModel({
            model: platformKimi.chat(PROVIDER_MODELS.kimi.reasoning),
            middleware: extractReasoningMiddleware({ tagName: "think" }),
          }),
          "title-model": platformKimi.chat(PROVIDER_MODELS.kimi.title),
          "artifact-model": platformKimi.chat(PROVIDER_MODELS.kimi.artifact),
        },
      });
  }
}

/**
 * Get the display name for a BYOK provider
 */
export function getProviderDisplayName(provider: BYOKProvider): string {
  switch (provider) {
    case "kimi":
      return "Moonshot Kimi";
    case "gemini":
      return "Google Gemini";
    case "anthropic":
      return "Anthropic Claude";
    default:
      return "Unknown";
  }
}

/**
 * Validate API key format for a specific provider
 */
export function validateProviderApiKey(
  provider: BYOKProvider,
  apiKey: string
): { valid: boolean; error?: string } {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: "API key is required" };
  }

  switch (provider) {
    case "kimi":
      // Moonshot keys start with "sk-"
      if (!apiKey.startsWith("sk-")) {
        return {
          valid: false,
          error: "Moonshot API keys should start with 'sk-'",
        };
      }
      if (apiKey.length < 20) {
        return { valid: false, error: "API key appears too short" };
      }
      return { valid: true };

    case "gemini":
      // Google API keys are typically 39 characters, alphanumeric with underscores
      if (apiKey.length < 30) {
        return { valid: false, error: "API key appears too short" };
      }
      return { valid: true };

    case "anthropic":
      // Anthropic keys start with "sk-ant-"
      if (!apiKey.startsWith("sk-ant-")) {
        return {
          valid: false,
          error: "Anthropic API keys should start with 'sk-ant-'",
        };
      }
      if (apiKey.length < 40) {
        return { valid: false, error: "API key appears too short" };
      }
      return { valid: true };

    default:
      return { valid: false, error: "Unknown provider" };
  }
}

// Default provider using platform's API key
// Kept for backwards compatibility
export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : getProviderForUser(); // Use platform key by default
