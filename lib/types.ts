import type {
  ContextRequirementType,
  ToolRequirements,
} from "@ctxprotocol/sdk";
import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
  debugCode: string;
  debugResult: string;
  toolStatus: { status: string };
  executionProgress: {
    type: string;
    toolName: string;
    message: string;
    timestamp: number;
  };
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};

/**
 * Wallet Linking Requirement
 *
 * Sent via data stream when a tool requires portfolio context
 * but the user has no linked wallets. Triggers the in-chat
 * wallet linking prompt flow.
 */
export type WalletLinkingRequirement = {
  /** Context types needed by selected tools (e.g., "polymarket", "hyperliquid") */
  requiredContext: ContextRequirementType[];
  /** Summary of tools that were selected (for display purposes) */
  selectedTools: Array<{ id: string; name: string; price: string }>;
  /** Original user query to retry after wallet is linked */
  originalQuery: string;
};

// =============================================================================
// CONTEXT REQUIREMENTS (from @ctxprotocol/sdk - Single Source of Truth)
// =============================================================================

/**
 * @deprecated The `requirements` field at tool level gets stripped by MCP SDK.
 * Use `x-context-requirements` inside `inputSchema` instead.
 *
 * @example
 * ```typescript
 * // ❌ OLD (doesn't work - stripped by MCP transport)
 * { requirements: { context: ["hyperliquid"] } }
 *
 * // ✅ NEW (works - preserved in inputSchema)
 * { inputSchema: { "x-context-requirements": ["hyperliquid"], ... } }
 * ```
 */
export type { ContextRequirementType, ToolRequirements };
