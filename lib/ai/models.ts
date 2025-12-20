import type { BYOKProvider } from "../db/schema";

// Default to Gemini 3 Flash for all users (fast and cost-effective)
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
 * Used for BYOK users to show provider-appropriate model names
 */
export const PROVIDER_MODEL_INFO: Record<
  BYOKProvider,
  {
    chat: { name: string; description: string };
    reasoning: { name: string; description: string };
  }
> = {
  gemini: {
    chat: {
      name: "Gemini 3 Pro",
      description:
        "Fast responses with advanced capabilities for everyday tasks",
    },
    reasoning: {
      name: "Gemini 3 Pro Thinking",
      description:
        "Deep reasoning with thinking capabilities for complex tasks",
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
 * Base chat models (platform defaults via OpenRouter)
 * Order: Gemini models first (Flash default, then Pro), then Claude models
 * All models available to Convenience tier (default) - paid via USDC wallet
 * - Gemini Flash: DEFAULT (cheapest, excellent for tool calling)
 * - Gemini Pro: Advanced reasoning
 * - Claude Sonnet 4.5: Premium quality
 * - Claude Opus 4.5: Most capable
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
    id: "claude-sonnet-model",
    name: "Claude Sonnet 4.5",
    description: "Fast, intelligent Claude with extended thinking",
    // Claude Sonnet 4.5 pricing via OpenRouter: ~$3/1M input, ~$15/1M output
    // Average ~2000 input + ~500 output = ~$0.0135 avg
    // With reasoning tokens (~1000): ~$0.021 avg
    estimatedCostPerQuery: 0.021,
    supportsBYOK: false, // Platform model via OpenRouter
  },
  {
    id: "claude-opus-model",
    name: "Claude Opus 4.5",
    description: "Most capable model with superior reasoning",
    // Claude Opus 4.5 pricing via OpenRouter: ~$15/1M input, ~$75/1M output
    // Average ~2000 input + ~500 output = ~$0.0675 avg
    // With reasoning tokens (~1000): ~$0.105 avg
    estimatedCostPerQuery: 0.105,
    supportsBYOK: false, // Platform model via OpenRouter
  },
];

/**
 * Get chat models with provider-specific names
 * @param provider - The BYOK provider (or null for platform default)
 * @returns Array of chat models. For BYOK, returns provider-specific models.
 *          For platform (null), returns all platform models.
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
        // BYOK users pay their own API costs, so we use minimal estimate
        estimatedCostPerQuery: 0.003,
        supportsBYOK: true,
      },
      {
        id: "chat-model-reasoning",
        name: providerInfo.reasoning.name,
        description: providerInfo.reasoning.description,
        // Reasoning models use more tokens
        estimatedCostPerQuery: 0.008,
        supportsBYOK: true,
      },
    ];
  }

  // Platform mode (Convenience tier) - return all platform models
  // All models available - paid via USDC wallet
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
      id: "claude-sonnet-model",
      name: "Claude Sonnet 4.5",
      description: "Fast, intelligent Claude with extended thinking",
      estimatedCostPerQuery: 0.021,
      supportsBYOK: false,
    },
    {
      id: "claude-opus-model",
      name: "Claude Opus 4.5",
      description: "Most capable model with superior reasoning",
      estimatedCostPerQuery: 0.105,
      supportsBYOK: false,
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
