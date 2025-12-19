import type { LanguageModelUsage } from "ai";
import type { UsageData } from "tokenlens/helpers";

// Server-merged usage: base AI SDK usage + cost data (via OpenRouter pricing) + optional modelId
export type AppUsage = LanguageModelUsage & UsageData & { modelId?: string };
