import "server-only";

import type { ModelCatalog, Pricing } from "tokenlens/core";

/**
 * OpenRouter Model Pricing
 *
 * Fetches authoritative pricing directly from OpenRouter's API.
 * This ensures cost calculations are always accurate for OpenRouter-routed requests,
 * eliminating any potential mismatch with third-party catalogs like models.dev.
 *
 * OpenRouter pricing includes:
 * - prompt: Cost per input token
 * - completion: Cost per output token
 * - internal_reasoning: Cost per reasoning token (Claude extended thinking)
 * - input_cache_read: Cost per cached input token read
 * - input_cache_write: Cost per cached input token write
 */

// OpenRouter API response types
type OpenRouterPricing = {
  prompt: string;
  completion: string;
  request?: string;
  image?: string;
  web_search?: string;
  internal_reasoning?: string;
  input_cache_read?: string;
  input_cache_write?: string;
};

type OpenRouterModel = {
  id: string;
  name: string;
  pricing: OpenRouterPricing;
  context_length: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
  };
};

type OpenRouterModelsResponse = {
  data: OpenRouterModel[];
};

// Models we use via OpenRouter
const OPENROUTER_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-3-pro-preview",
  "anthropic/claude-opus-4.5",
  "anthropic/claude-sonnet-4.5",
] as const;

/**
 * Convert OpenRouter pricing (per-token) to tokenlens format (per-million-tokens)
 */
function convertPricing(orPricing: OpenRouterPricing): Pricing {
  const toPerMillion = (value: string | undefined): number | undefined => {
    if (!value || value === "0") {
      return;
    }
    // OpenRouter prices are per-token, tokenlens expects per-million-tokens
    return Number.parseFloat(value) * 1_000_000;
  };

  return {
    inputPerMTokens: toPerMillion(orPricing.prompt),
    outputPerMTokens: toPerMillion(orPricing.completion),
    reasoningPerMTokens: toPerMillion(orPricing.internal_reasoning),
    cacheReadPerMTokens: toPerMillion(orPricing.input_cache_read),
    cacheWritePerMTokens: toPerMillion(orPricing.input_cache_write),
  };
}

/**
 * Fetch model pricing from OpenRouter API
 */
async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[openrouter-pricing] No API key, using fallback catalog");
    return [];
  }

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    // Cache for 1 hour
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    console.error(
      "[openrouter-pricing] Failed to fetch models:",
      response.status
    );
    return [];
  }

  const data = (await response.json()) as OpenRouterModelsResponse;
  return data.data;
}

/**
 * Build a tokenlens-compatible ModelCatalog from OpenRouter pricing
 *
 * This creates a catalog that can be passed to tokenlens's getUsage() function,
 * ensuring cost calculations use OpenRouter's authoritative pricing.
 */
export async function getOpenRouterCatalog(): Promise<ModelCatalog> {
  const models = await fetchOpenRouterModels();

  // Build catalog in tokenlens format
  // Structure: { [provider]: { models: { [modelId]: {...} } } }
  const catalog: ModelCatalog = {};

  for (const model of models) {
    // Only process models we actually use
    if (
      !OPENROUTER_MODELS.includes(
        model.id as (typeof OPENROUTER_MODELS)[number]
      )
    ) {
      continue;
    }

    // Extract provider from model ID (e.g., "google" from "google/gemini-3-flash-preview")
    const [provider, ...modelParts] = model.id.split("/");
    const modelSlug = modelParts.join("/");

    // Initialize provider if needed
    if (!catalog[provider]) {
      catalog[provider] = {
        id: provider,
        name: provider,
        models: {},
      };
    }

    // Add model with converted pricing
    const pricing = convertPricing(model.pricing);

    catalog[provider].models[modelSlug] = {
      id: modelSlug,
      name: model.name,
      cost: {
        input: pricing.inputPerMTokens,
        output: pricing.outputPerMTokens,
        reasoning: pricing.reasoningPerMTokens,
        cache_read: pricing.cacheReadPerMTokens,
        cache_write: pricing.cacheWritePerMTokens,
      },
      limit: {
        context: model.context_length,
      },
    };

    // Also add with full ID for direct lookups
    catalog[provider].models[model.id] = catalog[provider].models[modelSlug];
  }

  // Log pricing for debugging
  if (process.env.NODE_ENV === "development") {
    console.log("[openrouter-pricing] Loaded pricing for models:", {
      models: Object.keys(catalog).flatMap((p) =>
        Object.keys(catalog[p].models)
      ),
    });
  }

  return catalog;
}

/**
 * Fallback catalog with hardcoded OpenRouter pricing
 * Used when API fetch fails
 */
export function getFallbackCatalog(): ModelCatalog {
  // Pricing as of late 2024 - should match OpenRouter's actual prices
  // These are backup values; live fetch is preferred
  return {
    google: {
      id: "google",
      name: "Google",
      models: {
        "gemini-3-flash-preview": {
          id: "gemini-3-flash-preview",
          name: "Gemini 3 Flash Preview",
          cost: {
            input: 0.5, // $0.50 per 1M tokens
            output: 1.5, // $1.50 per 1M tokens
          },
          limit: { context: 1_000_000 },
        },
        "google/gemini-3-flash-preview": {
          id: "google/gemini-3-flash-preview",
          name: "Gemini 3 Flash Preview",
          cost: {
            input: 0.5,
            output: 1.5,
          },
          limit: { context: 1_000_000 },
        },
        "gemini-3-pro-preview": {
          id: "gemini-3-pro-preview",
          name: "Gemini 3 Pro Preview",
          cost: {
            input: 1.25, // $1.25 per 1M tokens
            output: 10.0, // $10.00 per 1M tokens
          },
          limit: { context: 1_000_000 },
        },
        "google/gemini-3-pro-preview": {
          id: "google/gemini-3-pro-preview",
          name: "Gemini 3 Pro Preview",
          cost: {
            input: 1.25,
            output: 10.0,
          },
          limit: { context: 1_000_000 },
        },
      },
    },
    anthropic: {
      id: "anthropic",
      name: "Anthropic",
      models: {
        "claude-sonnet-4.5": {
          id: "claude-sonnet-4.5",
          name: "Claude Sonnet 4.5",
          cost: {
            input: 3.0, // $3.00 per 1M tokens
            output: 15.0, // $15.00 per 1M tokens
            reasoning: 15.0, // Same as output for thinking tokens
          },
          limit: { context: 200_000 },
        },
        "anthropic/claude-sonnet-4.5": {
          id: "anthropic/claude-sonnet-4.5",
          name: "Claude Sonnet 4.5",
          cost: {
            input: 3.0,
            output: 15.0,
            reasoning: 15.0,
          },
          limit: { context: 200_000 },
        },
        "claude-opus-4.5": {
          id: "claude-opus-4.5",
          name: "Claude Opus 4.5",
          cost: {
            input: 15.0, // $15.00 per 1M tokens
            output: 75.0, // $75.00 per 1M tokens
            reasoning: 75.0, // Same as output for thinking tokens
          },
          limit: { context: 200_000 },
        },
        "anthropic/claude-opus-4.5": {
          id: "anthropic/claude-opus-4.5",
          name: "Claude Opus 4.5",
          cost: {
            input: 15.0,
            output: 75.0,
            reasoning: 75.0,
          },
          limit: { context: 200_000 },
        },
      },
    },
  };
}

/**
 * Get OpenRouter catalog with fallback
 * This is the main export - use this in route.ts
 */
export async function getOpenRouterPricingCatalog(): Promise<ModelCatalog> {
  try {
    const catalog = await getOpenRouterCatalog();

    // If we got an empty catalog, use fallback
    if (Object.keys(catalog).length === 0) {
      console.warn(
        "[openrouter-pricing] Empty catalog from API, using fallback"
      );
      return getFallbackCatalog();
    }

    return catalog;
  } catch (error) {
    console.error("[openrouter-pricing] Error fetching catalog:", error);
    return getFallbackCatalog();
  }
}



