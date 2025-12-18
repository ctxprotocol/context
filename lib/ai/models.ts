import type { BYOKProvider } from "../db/schema";

// Default to Gemini 3 Flash for all users (fast, free-tier friendly)
export const DEFAULT_CHAT_MODEL: string = "gemini-flash-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
  /**
   * Estimated cost per query in USD.
   * Used for upfront pricing before actual usage is known.
   * Based on average token usage patterns.
   */
  estimatedCostPerQuery: number;
  /**
   * Whether this model supports BYOK (Bring Your Own Key).
   * If true, users can provide their own API key to skip model costs.
   */
  supportsBYOK: boolean;
};

/**
 * Provider-specific model display names and descriptions
 */
export const PROVIDER_MODEL_INFO: Record<
  BYOKProvider,
  {
    chat: { name: string; description: string };
    reasoning: { name: string; description: string };
  }
> = {
  kimi: {
    chat: {
      name: "Kimi K2",
      description: "Advanced multimodal model with long context understanding",
    },
    reasoning: {
      name: "Kimi K2 Thinking",
      description:
        "Uses advanced chain-of-thought reasoning with extended thinking process",
    },
  },
  gemini: {
    chat: {
      name: "Gemini 3 Pro Thinking",
      description: "Fast responses with low thinking level for everyday tasks",
    },
    reasoning: {
      name: "Gemini 3 Pro Thinking+",
      description: "Deep reasoning with high thinking level for complex tasks",
    },
  },
  anthropic: {
    chat: {
      name: "Claude Sonnet 4.5",
      description: "Fast, intelligent model optimized for everyday tasks",
    },
    reasoning: {
      name: "Claude Opus 4.5",
      description:
        "Most capable Claude model with superior reasoning abilities",
    },
  },
};

/**
 * Base chat models (platform defaults)
 * Order: Gemini models first (Flash default, then Pro), then Kimi models
 * - Gemini Flash: Available to all tiers (via OpenRouter) - DEFAULT
 * - Gemini Pro: Convenience tier only (via OpenRouter)
 * - Kimi models: Available to all tiers
 */
export const chatModels: ChatModel[] = [
  {
    id: "gemini-flash-model",
    name: "Gemini 3 Flash",
    description: "Fast and efficient model for everyday tasks",
    // Gemini 3 Flash pricing via OpenRouter: ~$0.50/1M input, ~$1.50/1M output
    // Average ~2000 input + ~500 output = ~$0.00175 avg
    estimatedCostPerQuery: 0.002,
    supportsBYOK: false, // Platform model via OpenRouter
  },
  {
    id: "gemini-model",
    name: "Gemini 3 Pro",
    description: "Google's advanced reasoning model with thinking capabilities",
    // Gemini 3 Pro pricing via OpenRouter: ~$1.25/1M input, ~$10/1M output
    // Average ~2000 input + ~500 output = ~$0.0075 avg
    estimatedCostPerQuery: 0.0075,
    supportsBYOK: false, // Platform model via OpenRouter
  },
  {
    id: "chat-model",
    name: PROVIDER_MODEL_INFO.kimi.chat.name,
    description: PROVIDER_MODEL_INFO.kimi.chat.description,
    // Average ~2000 input + ~500 output tokens per query
    // Kimi K2 pricing: ~$0.001/1K input, ~$0.002/1K output = ~$0.003 avg
    estimatedCostPerQuery: 0.003,
    supportsBYOK: true,
  },
  {
    id: "chat-model-reasoning",
    name: PROVIDER_MODEL_INFO.kimi.reasoning.name,
    description: PROVIDER_MODEL_INFO.kimi.reasoning.description,
    // Reasoning models use more tokens due to thinking process
    // ~3000 input + ~2000 output + ~1000 reasoning = ~$0.008 avg
    estimatedCostPerQuery: 0.008,
    supportsBYOK: true,
  },
];

/**
 * Get chat models with provider-specific names
 * @param provider - The BYOK provider (or null for platform default)
 * @returns Array of chat models. For BYOK, returns provider-specific models.
 *          For platform (null), returns all platform models including Gemini.
 */
export function getChatModelsForProvider(
  provider: BYOKProvider | null
): ChatModel[] {
  // BYOK mode - return provider-specific models only
  if (provider) {
    const providerInfo = PROVIDER_MODEL_INFO[provider];
    return [
      {
        id: "chat-model",
        name: providerInfo.chat.name,
        description: providerInfo.chat.description,
        estimatedCostPerQuery: 0.003,
        supportsBYOK: true,
      },
      {
        id: "chat-model-reasoning",
        name: providerInfo.reasoning.name,
        description: providerInfo.reasoning.description,
        estimatedCostPerQuery: 0.008,
        supportsBYOK: true,
      },
    ];
  }

  // Platform mode (Free/Convenience tier) - return all platform models
  // Order: Gemini models first (Flash default, then Pro), then Kimi models
  // Filtering by tier happens in model-selector
  const kimiInfo = PROVIDER_MODEL_INFO.kimi;
  return [
    {
      id: "gemini-flash-model",
      name: "Gemini 3 Flash",
      description: "Fast and efficient model for everyday tasks",
      estimatedCostPerQuery: 0.002,
      supportsBYOK: false,
    },
    {
      id: "gemini-model",
      name: "Gemini 3 Pro",
      description:
        "Google's advanced reasoning model with thinking capabilities",
      estimatedCostPerQuery: 0.0075,
      supportsBYOK: false,
    },
    {
      id: "chat-model",
      name: kimiInfo.chat.name,
      description: kimiInfo.chat.description,
      estimatedCostPerQuery: 0.003,
      supportsBYOK: true,
    },
    {
      id: "chat-model-reasoning",
      name: kimiInfo.reasoning.name,
      description: kimiInfo.reasoning.description,
      estimatedCostPerQuery: 0.008,
      supportsBYOK: true,
    },
  ];
}

/**
 * Get estimated model cost for a given model ID.
 * Returns 0 if model not found (fallback for unknown models).
 */
export function getEstimatedModelCost(modelId: string): number {
  const model = chatModels.find((m) => m.id === modelId);
  return model?.estimatedCostPerQuery ?? 0;
}
