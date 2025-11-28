export const DEFAULT_CHAT_MODEL: string = "chat-model";

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

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "Kimi K2",
    description: "Advanced multimodal model with long context understanding",
    // Average ~2000 input + ~500 output tokens per query
    // Kimi K2 pricing: ~$0.001/1K input, ~$0.002/1K output = ~$0.003 avg
    estimatedCostPerQuery: 0.003,
    supportsBYOK: true,
  },
  {
    id: "chat-model-reasoning",
    name: "Kimi K2 Thinking",
    description:
      "Uses advanced chain-of-thought reasoning with extended thinking process",
    // Reasoning models use more tokens due to thinking process
    // ~3000 input + ~2000 output + ~1000 reasoning = ~$0.008 avg
    estimatedCostPerQuery: 0.008,
    supportsBYOK: true,
  },
];

/**
 * Get estimated model cost for a given model ID.
 * Returns 0 if model not found (fallback for unknown models).
 */
export function getEstimatedModelCost(modelId: string): number {
  const model = chatModels.find((m) => m.id === modelId);
  return model?.estimatedCostPerQuery ?? 0;
}
