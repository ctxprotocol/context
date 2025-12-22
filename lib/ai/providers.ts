import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import type { BYOKProvider } from "../db/schema";

// =============================================================================
// BYOK Provider Configuration
// =============================================================================
// We support two providers for BYOK:
// 1. Google Gemini - Popular, good pricing, strong reasoning
// 2. Anthropic Claude - Premium quality, best for complex tasks
//
// NOTE: We explicitly do NOT support OpenAI due to concerns about their
// API usage tracking practices and history of competitive behavior.
// =============================================================================

// Platform's OpenRouter provider (handles reasoning_details natively)
// The official @openrouter/ai-sdk-provider automatically transforms
// OpenRouter's reasoning_details format to AI SDK's expected format
const platformOpenRouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Provider preferences for Gemini models to avoid Google AI Studio geo-restrictions
// Google AI Studio has geographic restrictions that can cause requests to fail with
// "User location is not supported for the API use" errors. We configure OpenRouter
// to skip Google AI Studio and allow fallbacks to other providers like Vertex AI.
// See: https://openrouter.ai/docs/guides/routing/provider-selection
const GEMINI_ROUTING_OPTIONS = {
  extraBody: {
    provider: {
      // Skip Google AI Studio which has geo-restrictions in some regions
      ignore: ["Google AI Studio"],
      // Ensure fallbacks are enabled so OpenRouter can try other providers
      allow_fallbacks: true,
    },
  },
};


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
  // OpenRouter model IDs (for platform users)
  // These are used via the official @openrouter/ai-sdk-provider
  openrouter: {
    geminiFlash: "google/gemini-3-flash-preview",
    geminiPro: "google/gemini-3-pro-preview",
    claudeOpus: "anthropic/claude-opus-4.5",
    claudeSonnet: "anthropic/claude-sonnet-4.5",
  },
  // Direct Google Gemini API model IDs (for BYOK users)
  gemini: {
    chat: "gemini-3-pro-preview",
    flash: "gemini-3-flash-preview",
    reasoning: "gemini-3-pro-preview",
    title: "gemini-2.5-flash",
    artifact: "gemini-2.5-flash",
  },
  // Direct Anthropic API model IDs (for BYOK users)
  // Claude 4.5 models via direct Anthropic API
  anthropic: {
    chat: "claude-sonnet-4-5-20250929",
    reasoning: "claude-opus-4-5-20251101",
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
 * Supports Gemini and Anthropic.
 *
 * Platform users get access to models via OpenRouter:
 * - Gemini Flash (default, cheapest)
 * - Gemini Pro
 * - Claude Sonnet 4.5
 * - Claude Opus 4.5 (most capable)
 *
 * The official @openrouter/ai-sdk-provider handles reasoning_details
 * natively - no extractReasoningMiddleware needed!
 */
export function getProviderForUser(byokConfig?: BYOKConfig) {
  // No BYOK config - use platform's OpenRouter provider
  // All models go through OpenRouter for unified billing and access
  if (!byokConfig) {
    return customProvider({
      languageModels: {
        // Gemini Flash - Default model, fast and efficient
        // Uses routing options to avoid Google AI Studio geo-restrictions
        "gemini-flash-model": platformOpenRouter(
          PROVIDER_MODELS.openrouter.geminiFlash,
          GEMINI_ROUTING_OPTIONS
        ),
        // Gemini Pro - Advanced reasoning
        // Uses routing options to avoid Google AI Studio geo-restrictions
        "gemini-model": platformOpenRouter(
          PROVIDER_MODELS.openrouter.geminiPro,
          GEMINI_ROUTING_OPTIONS
        ),
        // Claude Opus 4.5 - Most capable, superior reasoning
        "claude-opus-model": platformOpenRouter(
          PROVIDER_MODELS.openrouter.claudeOpus
        ),
        // Claude Sonnet 4.5 - Fast Claude with extended thinking
        "claude-sonnet-model": platformOpenRouter(
          PROVIDER_MODELS.openrouter.claudeSonnet
        ),
        // Backward compatibility aliases
        // chat-model -> Gemini Flash (default)
        // Uses routing options to avoid Google AI Studio geo-restrictions
        "chat-model": platformOpenRouter(
          PROVIDER_MODELS.openrouter.geminiFlash,
          GEMINI_ROUTING_OPTIONS
        ),
        // chat-model-reasoning -> Claude Sonnet (native reasoning)
        "chat-model-reasoning": platformOpenRouter(
          PROVIDER_MODELS.openrouter.claudeSonnet
        ),
        // title-model -> Gemini Flash (fast for title generation)
        // Uses routing options to avoid Google AI Studio geo-restrictions
        "title-model": platformOpenRouter(
          PROVIDER_MODELS.openrouter.geminiFlash,
          GEMINI_ROUTING_OPTIONS
        ),
        // artifact-model -> Gemini Flash (fast for artifacts)
        // Uses routing options to avoid Google AI Studio geo-restrictions
        "artifact-model": platformOpenRouter(
          PROVIDER_MODELS.openrouter.geminiFlash,
          GEMINI_ROUTING_OPTIONS
        ),
      },
    });
  }

  const { provider, apiKey } = byokConfig;

  switch (provider) {
    case "gemini": {
      const gemini = createGeminiProvider(apiKey);
      return customProvider({
        languageModels: {
          "chat-model": gemini(PROVIDER_MODELS.gemini.chat),
          "chat-model-reasoning": gemini(PROVIDER_MODELS.gemini.reasoning),
          // BYOK Gemini users also get Flash model
          "gemini-flash-model": gemini(PROVIDER_MODELS.gemini.flash),
          "gemini-model": gemini(PROVIDER_MODELS.gemini.chat),
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
          "chat-model-reasoning": anthropic(
            PROVIDER_MODELS.anthropic.reasoning
          ),
          // BYOK Anthropic users get Claude models
          "claude-opus-model": anthropic(PROVIDER_MODELS.anthropic.reasoning),
          "claude-sonnet-model": anthropic(PROVIDER_MODELS.anthropic.chat),
          "title-model": anthropic(PROVIDER_MODELS.anthropic.title),
          "artifact-model": anthropic(PROVIDER_MODELS.anthropic.artifact),
        },
      });
    }

    default:
      // Fallback to platform default (OpenRouter)
      // Uses routing options to avoid Google AI Studio geo-restrictions for Gemini
      return customProvider({
        languageModels: {
          "gemini-flash-model": platformOpenRouter(
            PROVIDER_MODELS.openrouter.geminiFlash,
            GEMINI_ROUTING_OPTIONS
          ),
          "gemini-model": platformOpenRouter(
            PROVIDER_MODELS.openrouter.geminiPro,
            GEMINI_ROUTING_OPTIONS
          ),
          "claude-opus-model": platformOpenRouter(
            PROVIDER_MODELS.openrouter.claudeOpus
          ),
          "claude-sonnet-model": platformOpenRouter(
            PROVIDER_MODELS.openrouter.claudeSonnet
          ),
          "chat-model": platformOpenRouter(
            PROVIDER_MODELS.openrouter.geminiFlash,
            GEMINI_ROUTING_OPTIONS
          ),
          "chat-model-reasoning": platformOpenRouter(
            PROVIDER_MODELS.openrouter.claudeSonnet
          ),
          "title-model": platformOpenRouter(
            PROVIDER_MODELS.openrouter.geminiFlash,
            GEMINI_ROUTING_OPTIONS
          ),
          "artifact-model": platformOpenRouter(
            PROVIDER_MODELS.openrouter.geminiFlash,
            GEMINI_ROUTING_OPTIONS
          ),
        },
      });
  }
}

/**
 * Get the display name for a BYOK provider
 */
export function getProviderDisplayName(provider: BYOKProvider): string {
  switch (provider) {
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

/**
 * Check if a model supports native reasoning via OpenRouter
 * Claude models support native reasoning_details
 */
export function modelSupportsNativeReasoning(modelId: string): boolean {
  return modelId.includes("claude");
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
        geminiFlashModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "gemini-flash-model": geminiFlashModel,
          "gemini-model": geminiFlashModel,
          "claude-opus-model": reasoningModel,
          "claude-sonnet-model": chatModel,
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : getProviderForUser(); // Use platform key by default
