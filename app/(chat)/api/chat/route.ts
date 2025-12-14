import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  generateText,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { unstable_cache as cache } from "next/cache";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import { auth, type UserType } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/visibility-selector";
import {
  buildMediatorText,
  executeWithSelfHealing,
} from "@/lib/ai/agentic-execution";
import {
  type AllowedModule,
  executeSkillCode,
  REGISTERED_SKILL_MODULES,
} from "@/lib/ai/code-executor";
import {
  determineFlowType,
  type FlowType,
  recordActualCost,
} from "@/lib/ai/cost-estimation";
import {
  canMakeQuery,
  entitlementsByUserType,
  FREE_TIER_DAILY_LIMIT,
  type UserTier,
} from "@/lib/ai/entitlements";
import { type ChatModel, getEstimatedModelCost } from "@/lib/ai/models";
import {
  buildToolSelectionPrompt,
  type EnabledToolSummary,
  type MarketplaceToolResult,
  type RequestHints,
  regularPrompt,
  systemPrompt,
  toolSelectionPrompt,
} from "@/lib/ai/prompts";
import {
  type BYOKConfig,
  getProviderForUser,
  myProvider,
} from "@/lib/ai/providers";
import { searchMarketplace } from "@/lib/ai/skills/marketplace";
import { refreshMcpToolSchema } from "@/lib/ai/skills/mcp";
import type { AllowedToolContext } from "@/lib/ai/skills/runtime";
import { isProductionEnvironment } from "@/lib/constants";
import { detectContextRequirementsForTools } from "@/lib/context/detection";
import { decryptApiKey } from "@/lib/crypto";
import {
  addAccumulatedModelCost,
  createStreamId,
  deleteChatById,
  getAIToolById,
  getChatById,
  getFreeQueriesUsedToday,
  getMessageCountByUserId,
  getMessagesByChatId,
  getUserSettings,
  incrementFreeQueriesUsed,
  recordToolQuery,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import type { AITool, BYOKProvider, DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { getLinkedWalletsForUser } from "@/lib/privy";
import {
  verifyBatchPayment,
  verifyPayment,
} from "@/lib/tools/payment-verifier";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import {
  type AutoModePayment,
  type PostRequestBody,
  postRequestBodySchema,
} from "./schema";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

const BUILTIN_MODULES: AllowedModule[] = [
  "@/lib/ai/skills/document",
  "@/lib/ai/skills/suggestions",
  "@/lib/ai/skills/weather",
  // Marketplace search is always free
  "@/lib/ai/skills/marketplace",
  // Persistent storage for large data (Context Volume)
  "@/lib/ai/skills/storage",
];

const BUILTIN_MODULE_SET = new Set(BUILTIN_MODULES);
const REGISTERED_MODULE_SET = new Set<string>(REGISTERED_SKILL_MODULES);
const MCP_TOOL_MODULE = "@/lib/ai/skills/mcp" as const;

// Match code blocks with any language tag (ts, typescript, js, javascript, or none)
// This regex properly strips language tags so the code executor doesn't interpret them as code
const CODE_BLOCK_REGEX = /```(?:\w+)?\s*([\s\S]*?)```/i;
const IMPORT_REGEX = /^import\s+{[^}]+}\s+from\s+["']([^"']+)["'];?/gim;

// JSON extraction regexes for tool selection parsing
const JSON_CODE_BLOCK_REGEX = /```(?:json)?\s*([\s\S]*?)```/;
const RAW_JSON_REGEX = /\{[\s\S]*"selectedTools"[\s\S]*\}/;

type ExecutionStatus = "not_executed" | "success" | "failed";

function hasNonEmptyData(data: unknown): boolean {
  if (data === null || data === undefined) {
    return false;
  }
  if (typeof data === "string") {
    return data.trim().length > 0;
  }
  if (typeof data === "number" || typeof data === "boolean") {
    return true;
  }
  if (Array.isArray(data)) {
    return data.some(hasNonEmptyData);
  }
  if (typeof data === "object") {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return false;
    }
    // Special case for error object: if the object has exactly one key `error`, treat it as "no data"
    if (keys.length === 1 && keys[0] === "error") {
      return false;
    }
    return Object.values(data as Record<string, unknown>).some(hasNonEmptyData);
  }
  return false;
}

type PaidToolContext = {
  tool: AITool;
  transactionHash: string;
  module: AllowedModule;
};

function extractCodeBlock(text: string) {
  const match = CODE_BLOCK_REGEX.exec(text);
  if (!match) {
    return null;
  }
  return match[1].trim();
}

function findImportedModules(code: string): AllowedModule[] {
  const modules = new Set<AllowedModule>();
  let match: RegExpExecArray | null = IMPORT_REGEX.exec(code);
  while (match !== null) {
    const moduleName = match[1].trim();
    if (REGISTERED_MODULE_SET.has(moduleName)) {
      modules.add(moduleName as AllowedModule);
    }
    match = IMPORT_REGEX.exec(code);
  }
  return Array.from(modules);
}

function formatExecutionData(data: unknown, maxLength = 1200) {
  try {
    const json = JSON.stringify(data, null, 2) ?? "null";
    if (json.length <= maxLength) {
      return json;
    }
    return `${json.slice(0, maxLength)}…`;
  } catch {
    return String(data);
  }
}

function buildAllowedToolRuntimeMap(paidTools: PaidToolContext[]) {
  const map = new Map<string, AllowedToolContext>();
  for (const context of paidTools) {
    // All tools are MCP tools - track for billing
    map.set(context.tool.id, {
      tool: context.tool,
      transactionHash: context.transactionHash,
      executionCount: 0,
    });
  }
  return map;
}

function getMcpTools(tool: AITool) {
  const schema = tool.toolSchema;
  if (!schema || typeof schema !== "object") {
    return;
  }
  const tools = (schema as Record<string, unknown>).tools;
  if (Array.isArray(tools)) {
    return tools as {
      name: string;
      description?: string;
      inputSchema?: unknown;
      outputSchema?: unknown;
    }[];
  }
  return;
}

function getToolUsage(tool: AITool) {
  const schema = tool.toolSchema;
  if (!schema || typeof schema !== "object") {
    return;
  }
  const usage = (schema as Record<string, unknown>).usage;
  return typeof usage === "string" ? usage : undefined;
}

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      toolInvocations = [],
      isDebugMode = false,
      isAutoMode = false,
      autoModePayment,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
      toolInvocations?: { toolId: string; transactionHash: string }[];
      isDebugMode?: boolean;
      isAutoMode?: boolean;
      autoModePayment?: AutoModePayment;
    } = requestBody;

    // Auto Mode: Determine which phase we're in
    // - Discovery phase: isAutoMode=true, autoModePayment=undefined
    // - Execution phase: isAutoMode=true, autoModePayment has payment proof
    const isAutoModeDiscovery = isAutoMode && !autoModePayment;
    const isAutoModeExecution = isAutoMode && !!autoModePayment;

    if (process.env.NODE_ENV === "development") {
      console.log("[chat-api] request debug flags", {
        chatId: id,
        isDebugMode,
        isAutoMode,
        isAutoModeDiscovery,
        isAutoModeExecution,
        toolInvocationsCount: toolInvocations.length,
        willIgnoreToolInvocations: isAutoModeDiscovery,
      });
    }

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    // Anti-abuse limit check (high ceiling)
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    // === TIER SYSTEM: Determine user's tier and validate access ===
    const userSettingsData = await getUserSettings(session.user.id);
    const userTier: UserTier = (userSettingsData?.tier as UserTier) || "free";

    // Free tier: Check daily limit
    if (userTier === "free") {
      const queriesUsedToday = await getFreeQueriesUsedToday(session.user.id);

      if (!canMakeQuery(userTier, queriesUsedToday)) {
        return new ChatSDKError(
          "rate_limit:chat",
          `Free tier limit reached (${FREE_TIER_DAILY_LIMIT}/day). Add your own API key (BYOK) or enable Convenience Tier to continue.`
        ).toResponse();
      }
    }

    // BYOK tier: Get user's API key and provider for dynamic provider
    let byokConfig: BYOKConfig | undefined;
    if (userTier === "byok" && userSettingsData?.byokProvider) {
      const byokProvider = userSettingsData.byokProvider as BYOKProvider;

      // Get the encrypted key for the selected provider
      let encryptedKey: string | null = null;
      switch (byokProvider) {
        case "kimi":
          encryptedKey = userSettingsData.kimiApiKeyEncrypted;
          break;
        case "gemini":
          encryptedKey = userSettingsData.geminiApiKeyEncrypted;
          break;
        case "anthropic":
          encryptedKey = userSettingsData.anthropicApiKeyEncrypted;
          break;
      }

      if (encryptedKey) {
        try {
          const apiKey = decryptApiKey(encryptedKey);
          byokConfig = { provider: byokProvider, apiKey };
        } catch (decryptError) {
          console.error(
            "[chat-api] Failed to decrypt BYOK API key:",
            decryptError
          );
          return new ChatSDKError(
            "bad_request:chat",
            "Your API key could not be decrypted. Please update your API key in settings."
          ).toResponse();
        }
      } else {
        console.warn(
          "[chat-api] BYOK provider selected but no key found:",
          byokProvider
        );
        return new ChatSDKError(
          "bad_request:chat",
          "No API key configured for your selected provider. Please add an API key in settings."
        ).toResponse();
      }
    }

    // Get the appropriate provider based on tier and BYOK config
    const provider = byokConfig ? getProviderForUser(byokConfig) : myProvider;

    // In Auto Mode Discovery phase, ignore manually selected tools
    // Auto mode will discover and select tools itself
    const effectiveToolInvocations = isAutoModeDiscovery ? [] : toolInvocations;

    const paidTools = await Promise.all(
      effectiveToolInvocations.map(async (invocation) => {
        let tool = await getAIToolById({ id: invocation.toolId });
        if (!tool) {
          throw new ChatSDKError("not_found:chat", "Requested tool not found");
        }

        const toolKind = tool.toolSchema
          ? (tool.toolSchema as Record<string, unknown>).kind
          : undefined;

        // All tools are MCP tools
        if (toolKind !== "mcp") {
          throw new ChatSDKError(
            "bad_request:chat",
            `Tool "${tool.name}" is not a valid MCP tool.`
          );
        }

        // Self-healing: Refresh MCP tool schema if stale (TTL-based, 1 hour)
        // This ensures we always have the latest outputSchema from the MCP server
        try {
          const wasRefreshed = await refreshMcpToolSchema(tool);
          if (wasRefreshed) {
            // Re-fetch the tool to get the updated schema
            const refreshedTool = await getAIToolById({
              id: invocation.toolId,
            });
            if (refreshedTool) {
              tool = refreshedTool;
            }
          }
        } catch (err) {
          // Don't fail the request if schema refresh fails
          console.warn(
            `[chat-api] Schema refresh failed for ${tool.name}:`,
            err
          );
        }

        return {
          tool,
          transactionHash: invocation.transactionHash,
          module: MCP_TOOL_MODULE,
        };
      })
    );

    const paidToolModuleMap = new Map<AllowedModule, PaidToolContext[]>();
    const enabledToolSummaries: EnabledToolSummary[] = [];
    for (const entry of paidTools) {
      const list = paidToolModuleMap.get(entry.module) ?? [];
      list.push(entry);
      paidToolModuleMap.set(entry.module, list);

      enabledToolSummaries.push({
        toolId: entry.tool.id,
        name: entry.tool.name,
        description: entry.tool.description,
        price: entry.tool.pricePerQuery,
        kind: "mcp",
        usage: getToolUsage(entry.tool),
        mcpTools: getMcpTools(entry.tool),
      });
    }

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      // Only fetch messages if chat already exists
      messagesFromDb = await getMessagesByChatId({ id });
    } else {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
      // New chat - no need to fetch messages, it's empty
    }

    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;

    // === DYNAMIC COST ESTIMATION: Track flow type and AI calls ===
    // Determine flow type for cost tracking
    const flowType: FlowType = determineFlowType(
      isAutoMode,
      paidTools.length > 0 || isAutoModeExecution
    );
    let aiCallCount = 0;
    let totalActualCost = 0;
    // Get estimated cost upfront (base cost * flow multiplier)
    // Multipliers account for self-healing retries (up to 2 per execution)
    const baseCostEstimate = getEstimatedModelCost(selectedChatModel);
    const flowMultiplier =
      flowType === "auto_mode" ? 5.0 : flowType === "manual_tools" ? 3.0 : 1.0;
    const estimatedTotalCost = baseCostEstimate * flowMultiplier;

    // Branch 1: no paid tools selected AND Auto Mode is OFF → simple streaming chat.
    // When Auto Mode is ON, we need the agentic loop to execute searchMarketplace().
    if (paidTools.length === 0 && !isAutoMode) {
      const systemInstructions = systemPrompt({
        selectedChatModel,
        requestHints,
        isDebugMode, // Pass debug mode to control if coding agent prompt is included
      });

      const stream = createUIMessageStream({
        execute: ({ writer: dataStream }) => {
          const result = streamText({
            model: provider.languageModel(selectedChatModel),
            system: systemInstructions,
            messages: convertToModelMessages(uiMessages),
            stopWhen: stepCountIs(5),
            experimental_transform: smoothStream({ chunking: "word" }),
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: "stream-text",
            },
            onFinish: async ({ usage }) => {
              // Track AI call for cost estimation
              aiCallCount++;
              try {
                const providers = await getTokenlensCatalog();
                const modelId =
                  provider.languageModel(selectedChatModel).modelId;
                if (!modelId) {
                  finalMergedUsage = usage;
                  dataStream.write({
                    type: "data-usage",
                    data: finalMergedUsage,
                  });
                  return;
                }

                if (!providers) {
                  finalMergedUsage = usage;
                  dataStream.write({
                    type: "data-usage",
                    data: finalMergedUsage,
                  });
                  return;
                }

                const summary = getUsage({ modelId, usage, providers });
                finalMergedUsage = {
                  ...usage,
                  ...summary,
                  modelId,
                } as AppUsage;
                // Track actual cost for dynamic estimation
                if (finalMergedUsage.costUSD?.totalUSD) {
                  totalActualCost += Number(finalMergedUsage.costUSD.totalUSD);
                }
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
              } catch (err) {
                console.warn("TokenLens enrichment failed", err);
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
              }
            },
          });

          result.consumeStream();

          dataStream.merge(
            result.toUIMessageStream({
              sendReasoning: true,
            })
          );
        },
        generateId: generateUUID,
        onFinish: async ({ messages }) => {
          await saveMessages({
            messages: messages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });

          // === TIER SYSTEM: Track usage ===
          if (userTier === "free") {
            await incrementFreeQueriesUsed(session.user.id);
          }

          if (finalMergedUsage) {
            try {
              await updateChatLastContextById({
                chatId: id,
                context: finalMergedUsage,
              });

              // Track actual cost for convenience tier
              const actualCost =
                totalActualCost > 0
                  ? totalActualCost
                  : finalMergedUsage.costUSD?.totalUSD !== undefined
                    ? Number(finalMergedUsage.costUSD.totalUSD)
                    : 0;

              if (userTier === "convenience" && actualCost > 0) {
                await addAccumulatedModelCost(session.user.id, actualCost);

                // Record cost for dynamic estimation feedback loop
                await recordActualCost({
                  userId: session.user.id,
                  chatId: id,
                  modelId: selectedChatModel,
                  flowType,
                  estimatedCost: estimatedTotalCost,
                  actualCost,
                  aiCallCount,
                });
              }
            } catch (err) {
              console.warn("Unable to persist last usage for chat", id, err);
            }
          }
        },
        onError: () => {
          return "Oops, an error occurred!";
        },
      });

      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }

    // Branch 2: at least one paid tool selected → full two-step agentic loop with code execution.
    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        try {
          const baseModelMessages = convertToModelMessages(uiMessages);
          console.log("[chat-api] starting planning step", {
            chatId: id,
            toolInvocationsCount: toolInvocations.length,
            enabledToolIds: enabledToolSummaries.map((t) => t.toolId),
            isAutoModeDiscovery,
            isAutoModeExecution,
          });

          // ===========================================================
          // AUTO MODE DISCOVERY: Two-Step Flow (Early Branch)
          // ===========================================================
          // Discovery phase uses TWO-STEP SELECTION:
          // Step 1: Search marketplace directly (no AI code generation)
          // Step 2: Ask AI to select from ACTUAL results
          //
          // This is more robust than single-step because the AI sees actual
          // tool descriptions before making selection decisions.
          if (isAutoModeDiscovery) {
            // Signal discovery status FIRST for UI feedback
            dataStream.write({
              type: "data-toolStatus",
              data: { status: "discovering-tools" },
            });

            // Force flush to ensure UI updates immediately
            await new Promise((resolve) => setTimeout(resolve, 10));

            console.log(
              "[chat-api] Auto Mode Discovery: starting two-step selection",
              { chatId: id }
            );

            // STEP 1: Extract user query and search marketplace directly
            const userQuery = message.parts
              .filter(
                (p): p is { type: "text"; text: string } => p.type === "text"
              )
              .map((p) => p.text)
              .join(" ");

            // Build conversation context for follow-up detection
            const conversationContext = uiMessages
              .slice(-6) // Last 3 turns (user + assistant pairs)
              .filter((m) => m.role === "assistant" || m.role === "user")
              .map((m) => {
                const text = m.parts
                  .filter(
                    (p): p is { type: "text"; text: string } =>
                      p.type === "text"
                  )
                  .map((p) => p.text)
                  .join(" ");
                return `${m.role}: ${text.slice(0, 200)}${text.length > 200 ? "..." : ""}`;
              })
              .join("\n");

            let searchResults: MarketplaceToolResult[] = [];
            try {
              // Search with a broad query to find relevant tools
              searchResults = await searchMarketplace(userQuery, 10);
              console.log(
                "[chat-api] Auto Mode Discovery Step 1: search complete",
                {
                  chatId: id,
                  query: userQuery.slice(0, 100),
                  resultsCount: searchResults.length,
                }
              );
            } catch (searchError) {
              console.error("[chat-api] Auto Mode Discovery: search failed", {
                chatId: id,
                error: searchError,
              });
              // Continue with empty results - AI will report no tools found
            }

            // Log search results (don't stream to UI - the selection stream handles display)
            console.log(
              "[chat-api] Auto Mode Discovery Step 1: search results",
              {
                chatId: id,
                tools: searchResults.map((t) => ({
                  id: t.id,
                  name: t.name,
                  price: t.price,
                })),
              }
            );

            // STEP 2: Ask AI to select from actual results (with streaming for UI feedback)
            const selectionUserPrompt = buildToolSelectionPrompt(
              userQuery,
              searchResults,
              conversationContext
            );

            console.log(
              "[chat-api] Auto Mode Discovery Step 2: asking AI to select",
              { chatId: id }
            );

            // Stream the selection process so user sees AI reasoning (like planning phase)
            const selectionStream = streamText({
              model: provider.languageModel(selectedChatModel),
              system: toolSelectionPrompt,
              messages: [{ role: "user", content: selectionUserPrompt }],
            });

            let selectionText = "";
            let selectionReasoning = "";

            // Stream chunks to client for real-time display (matches planning phase behavior)
            for await (const part of selectionStream.fullStream) {
              if (part.type === "reasoning-delta") {
                const delta = (part as { text?: string }).text;
                if (delta) {
                  selectionReasoning += delta;
                  dataStream.write({
                    type: "data-reasoning",
                    data: selectionReasoning,
                  });
                }
              } else if (part.type === "text-delta") {
                const delta = (part as { text?: string }).text;
                if (delta) {
                  // First text-delta after reasoning means reasoning is complete
                  if (
                    selectionReasoning.length > 0 &&
                    selectionText.length === 0
                  ) {
                    dataStream.write({
                      type: "data-reasoningComplete",
                      data: true,
                    });
                  }
                  selectionText += delta;
                  // Stream as debug code so thinking accordion shows it
                  dataStream.write({
                    type: "data-debugCode",
                    data: selectionText,
                  });
                }
              }
            }

            // Track AI call for cost estimation (tool selection)
            aiCallCount++;

            // Get usage data from selection stream and track actual cost
            try {
              const selectionUsage = await selectionStream.usage;
              const providers = await getTokenlensCatalog();
              const modelId = provider.languageModel(selectedChatModel).modelId;
              if (modelId && providers && selectionUsage) {
                const summary = getUsage({
                  modelId,
                  usage: selectionUsage,
                  providers,
                });
                if (summary.costUSD?.totalUSD) {
                  totalActualCost += Number(summary.costUSD.totalUSD);
                  console.log(
                    "[chat-api] Auto Mode Discovery: selection cost tracked",
                    {
                      chatId: id,
                      cost: summary.costUSD.totalUSD,
                      totalActualCost,
                    }
                  );
                }
              }
            } catch (err) {
              console.warn(
                "[chat-api] Auto Mode Discovery: failed to track selection cost",
                err
              );
            }

            selectionText = selectionText.trim();

            // Parse the AI's JSON response
            let discoveryResult: {
              selectedTools?: Array<{
                id: string;
                name: string;
                price: string;
                mcpMethod?: string; // Which specific method the AI plans to use
                reason?: string;
              }>;
              selectionReasoning?: string;
              error?: string;
              dataAlreadyAvailable?: boolean;
            } = { selectedTools: [] };

            try {
              // Extract JSON from the response (handle markdown code blocks and text before JSON)
              let jsonText = selectionText;

              // Try to extract from code block first (```json or ``` with no tag)
              const jsonMatch = JSON_CODE_BLOCK_REGEX.exec(jsonText);
              if (jsonMatch) {
                jsonText = jsonMatch[1].trim();
              } else {
                // No code block - try to find raw JSON object in the text
                // Look for { ... } pattern that contains "selectedTools"
                const rawJsonMatch = RAW_JSON_REGEX.exec(jsonText);
                if (rawJsonMatch) {
                  jsonText = rawJsonMatch[0];
                }
              }

              discoveryResult = JSON.parse(jsonText);
              console.log(
                "[chat-api] Auto Mode Discovery: parsed selection successfully",
                {
                  chatId: id,
                  selectedCount: discoveryResult.selectedTools?.length ?? 0,
                }
              );
            } catch (parseError) {
              console.error(
                "[chat-api] Auto Mode Discovery: failed to parse selection",
                {
                  chatId: id,
                  response: selectionText.slice(0, 500),
                  error: parseError,
                }
              );
              discoveryResult = {
                selectedTools: [],
                error: "Failed to parse tool selection response",
              };
            }

            // Enrich selected tools with full data from search results
            const enrichedSelectedTools = (discoveryResult.selectedTools || [])
              .map((selected) => {
                const fullTool = searchResults.find(
                  (t) => t.id === selected.id
                );
                if (!fullTool) {
                  console.warn(
                    "[chat-api] Selected tool not found in search results:",
                    selected.id
                  );
                  return null;
                }
                return {
                  id: selected.id,
                  name: fullTool.name,
                  description: fullTool.description,
                  price: fullTool.price,
                  mcpTools: fullTool.mcpTools,
                  mcpMethod: selected.mcpMethod, // Which specific method AI plans to use
                  reason: selected.reason,
                };
              })
              .filter(Boolean) as Array<{
              id: string;
              name: string;
              description: string;
              price: string;
              mcpTools?: Array<{ name: string; description?: string }>;
              mcpMethod?: string;
              reason?: string;
            }>;

            // Stream the selection result for debugging
            dataStream.write({
              type: "data-debugResult",
              data: formatExecutionData({
                step: "tool_selection",
                selectedTools: enrichedSelectedTools,
                selectionReasoning: discoveryResult.selectionReasoning,
                dataAlreadyAvailable: discoveryResult.dataAlreadyAvailable,
              }),
            });

            console.log(
              "[chat-api] Auto Mode Discovery Step 2: selection complete",
              {
                chatId: id,
                selectedCount: enrichedSelectedTools.length,
                dataAlreadyAvailable: discoveryResult.dataAlreadyAvailable,
                tools: enrichedSelectedTools.map((t) => t.name),
              }
            );

            // Check if tools were selected
            const dataAlreadyAvailable =
              discoveryResult.dataAlreadyAvailable === true;

            if (enrichedSelectedTools.length === 0) {
              // No tools selected - data available or no matches
              console.log(
                "[chat-api] Auto Mode Discovery: no paid tools selected",
                {
                  chatId: id,
                  dataAlreadyAvailable,
                  reason:
                    discoveryResult.error || discoveryResult.selectionReasoning,
                }
              );

              // Clear discovery content before transitioning
              dataStream.write({
                type: "data-clearDiscovery",
                data: true,
              });

              dataStream.write({
                type: "data-toolStatus",
                data: { status: "thinking" },
              });

              // Build mediator text and proceed to final response
              const noToolsMediatorText = dataAlreadyAvailable
                ? `Tool discovery completed. The requested data is already available in the conversation history.
DATA_ALREADY_AVAILABLE: true
Selection reasoning: ${discoveryResult.selectionReasoning || "Data from previous tool calls can be used to answer this question."}

IMPORTANT: Use ONLY the data that was fetched in previous turns. Do NOT invent new values.`
                : discoveryResult.error
                  ? `Tool discovery completed but no suitable tools found: ${discoveryResult.error}`
                  : `Tool discovery completed. No paid tools required for this query.
Selection reasoning: ${discoveryResult.selectionReasoning || "N/A"}`;

              // Generate final response
              const mediatorMessage: ChatMessage = {
                id: generateUUID(),
                role: "assistant",
                parts: [
                  {
                    type: "text",
                    text: `[[EXECUTION SUMMARY]]\n${noToolsMediatorText}`,
                  },
                ],
              };

              const finalMessages = convertToModelMessages([
                ...uiMessages,
                mediatorMessage,
              ]);

              const result = streamText({
                model: provider.languageModel(selectedChatModel),
                system: `${regularPrompt}

You are responding to the user *after* tools have already been evaluated.

You will see an internal assistant message that starts with "[[EXECUTION SUMMARY]]".

- If DATA_ALREADY_AVAILABLE is true, answer using the data from the conversation history. Do NOT invent new values.
- If no suitable tools were found, explain this to the user and suggest alternatives if possible.
- Keep your response concise and helpful.`,
                messages: finalMessages,
                stopWhen: stepCountIs(5),
                experimental_transform: smoothStream({ chunking: "word" }),
                onFinish: async ({ usage }) => {
                  // Track AI call for cost estimation (no-tools final response)
                  aiCallCount++;
                  try {
                    const providers = await getTokenlensCatalog();
                    const modelId =
                      provider.languageModel(selectedChatModel).modelId;
                    if (modelId && providers) {
                      const summary = getUsage({ modelId, usage, providers });
                      finalMergedUsage = {
                        ...usage,
                        ...summary,
                        modelId,
                      } as AppUsage;
                    } else {
                      finalMergedUsage = usage;
                    }
                    // Track actual cost for dynamic estimation
                    if (finalMergedUsage?.costUSD?.totalUSD) {
                      totalActualCost += Number(
                        finalMergedUsage.costUSD.totalUSD
                      );
                    }
                    dataStream.write({
                      type: "data-usage",
                      data: finalMergedUsage,
                    });
                  } catch (err) {
                    console.warn("TokenLens enrichment failed", err);
                    finalMergedUsage = usage;
                    dataStream.write({
                      type: "data-usage",
                      data: finalMergedUsage,
                    });
                  }
                },
              });

              result.consumeStream();
              dataStream.merge(
                result.toUIMessageStream({ sendReasoning: true })
              );
              return;
            }

            // ─────────────────────────────────────────────────────────────────
            // WALLET LINKING CHECK
            // Before proceeding to payment, check if selected tools require
            // portfolio context and if the user has linked wallets.
            // ─────────────────────────────────────────────────────────────────

            // Debug: Log what we're checking for context requirements
            console.log("[chat-api] Wallet linking check: inspecting tools", {
              chatId: id,
              toolCount: enrichedSelectedTools.length,
              tools: enrichedSelectedTools.map((t) => ({
                name: t.name,
                mcpMethod: t.mcpMethod, // Which specific method AI plans to use
                hasMcpTools: Boolean(t.mcpTools),
                mcpToolCount: t.mcpTools?.length ?? 0,
                // Show schema for the selected method only
                selectedMethodSchema: t.mcpMethod
                  ? (() => {
                      const method = t.mcpTools?.find(
                        (m) => m.name === t.mcpMethod
                      );
                      return {
                        found: Boolean(method),
                        hasInputSchema: Boolean((method as any)?.inputSchema),
                        schemaKeys:
                          (method as any)?.inputSchema?.properties &&
                          Object.keys((method as any).inputSchema.properties),
                      };
                    })()
                  : "no method specified - checking all",
              })),
            });

            const contextRequirements = detectContextRequirementsForTools(
              enrichedSelectedTools
            );

            console.log(
              "[chat-api] Wallet linking check: context requirements",
              {
                chatId: id,
                requirementsCount: contextRequirements.size,
                requirements: Array.from(contextRequirements),
              }
            );

            if (contextRequirements.size > 0) {
              // Tools require portfolio context - check for linked wallets
              const linkedWallets = await getLinkedWalletsForUser(
                session.user.id
              );

              if (linkedWallets.length === 0) {
                // User has no linked wallets - prompt them to link one
                console.log("[chat-api] Auto Mode: wallet linking required", {
                  chatId: id,
                  requiredContext: Array.from(contextRequirements),
                  toolCount: enrichedSelectedTools.length,
                });

                dataStream.write({
                  type: "data-walletLinkingRequired",
                  data: {
                    requiredContext: Array.from(contextRequirements),
                    selectedTools: enrichedSelectedTools.map((t) => ({
                      id: t.id,
                      name: t.name,
                      price: t.price,
                    })),
                    originalQuery: userQuery,
                  },
                });

                // Clear discovery UI and return early - wait for wallet linking
                dataStream.write({
                  type: "data-clearDiscovery",
                  data: true,
                });

                return;
              }

              console.log(
                "[chat-api] Auto Mode: user has linked wallets, proceeding",
                {
                  chatId: id,
                  linkedWalletCount: linkedWallets.length,
                  requiredContext: Array.from(contextRequirements),
                }
              );
            }

            // Tools were selected - calculate cost and await payment
            const totalCost = enrichedSelectedTools.reduce((sum, tool) => {
              return sum + Number(tool.price ?? 0);
            }, 0);

            console.log("[chat-api] Auto Mode Discovery: tools selected", {
              chatId: id,
              toolCount: enrichedSelectedTools.length,
              totalCost,
              tools: enrichedSelectedTools.map((t) => ({
                id: t.id,
                name: t.name,
                price: t.price,
              })),
            });

            // Fetch full tool details
            const toolDetails = await Promise.all(
              enrichedSelectedTools.map(async (selected) => {
                const tool = await getAIToolById({ id: selected.id });
                return {
                  toolId: selected.id,
                  name: selected.name,
                  description: selected.description || tool?.description || "",
                  price: selected.price,
                  developerWallet: tool?.developerWallet || "",
                  mcpTools: selected.mcpTools,
                  reason: selected.reason,
                };
              })
            );

            // Send tool selection to client for approval
            dataStream.write({
              type: "data-autoModeToolSelection",
              data: {
                selectedTools: toolDetails,
                totalCost: totalCost.toFixed(6),
                selectionReasoning: discoveryResult.selectionReasoning,
                originalQuery: userQuery,
              },
            });

            // Signal awaiting payment
            dataStream.write({
              type: "data-toolStatus",
              data: { status: "awaiting-tool-approval" },
            });

            console.log("[chat-api] Auto Mode Discovery: awaiting payment", {
              chatId: id,
              totalCost,
            });

            // Record discovery phase cost before returning
            // This ensures the tool selection AI call cost is tracked even though
            // the full agentic flow will continue in a separate request after payment
            if (userTier === "convenience" && totalActualCost > 0) {
              try {
                await addAccumulatedModelCost(session.user.id, totalActualCost);
                await recordActualCost({
                  userId: session.user.id,
                  chatId: id,
                  modelId: selectedChatModel,
                  flowType: "auto_mode", // Discovery is part of auto_mode
                  estimatedCost: estimatedTotalCost,
                  actualCost: totalActualCost,
                  aiCallCount,
                });
                console.log(
                  "[chat-api] Auto Mode Discovery: recorded discovery phase cost",
                  {
                    chatId: id,
                    actualCost: totalActualCost,
                    aiCallCount,
                  }
                );
              } catch (err) {
                console.warn(
                  "[chat-api] Auto Mode Discovery: failed to record cost",
                  err
                );
              }
            }

            // Return early - wait for payment
            return;
          }

          // Choose the appropriate prompt based on the phase
          let planningSystemInstructions: string;

          if (isAutoModeExecution && autoModePayment) {
            // Execution phase: Signal status IMMEDIATELY before any async work
            // This ensures client sees "Planning execution..." right away, not "Confirming payment..."
            dataStream.write({
              type: "data-toolStatus",
              data: { status: "planning" },
            });
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Build tool summaries from paid-for tools
            const executionToolSummaries: EnabledToolSummary[] =
              await Promise.all(
                autoModePayment.selectedTools.map(async (selected) => {
                  const dbTool = await getAIToolById({ id: selected.toolId });
                  const toolSchema = dbTool?.toolSchema as Record<
                    string,
                    unknown
                  > | null;
                  const mcpTools = toolSchema?.tools as
                    | Array<{
                        name: string;
                        description?: string;
                        inputSchema?: unknown;
                        outputSchema?: unknown;
                      }>
                    | undefined;

                  return {
                    toolId: selected.toolId,
                    name: selected.name,
                    description: dbTool?.description ?? "",
                    price: selected.price,
                    kind: "mcp" as const,
                    mcpTools: mcpTools?.map((t) => ({
                      name: t.name,
                      description: t.description,
                      inputSchema: t.inputSchema,
                      outputSchema: t.outputSchema,
                    })),
                  };
                })
              );

            planningSystemInstructions = systemPrompt({
              selectedChatModel,
              requestHints,
              enabledTools: executionToolSummaries,
              isDebugMode,
              isAutoModeExecution: true, // Focused execution prompt
            });
          } else {
            // Regular mode: Use standard prompt with manually selected tools
            planningSystemInstructions = systemPrompt({
              selectedChatModel,
              requestHints,
              enabledTools: enabledToolSummaries,
              isDebugMode,
            });
          }

          // Signal appropriate status based on phase
          dataStream.write({
            type: "data-toolStatus",
            data: {
              status: isAutoModeDiscovery ? "discovering-tools" : "planning",
            },
          });

          // Force a tiny delay to ensure the chunk is flushed
          await new Promise((resolve) => setTimeout(resolve, 10));

          // STREAMING PLANNER:
          // Use streamText with fullStream to capture both reasoning and code.
          // fullStream preserves reasoning parts that Kimi K2 Thinking outputs natively.
          // NOTE: smoothStream is NOT used here as it's incompatible with fullStream.
          const planningResult = streamText({
            model: provider.languageModel(selectedChatModel),
            system: planningSystemInstructions,
            messages: baseModelMessages,
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: "planning-stream-text",
            },
          });

          let planningText = "";
          let reasoningText = "";

          // Stream each chunk to the client for real-time display
          // Both reasoning-delta and text-delta use .text property
          for await (const part of planningResult.fullStream) {
            if (part.type === "reasoning-delta") {
              const delta = (part as { text?: string }).text;
              if (delta) {
                reasoningText += delta;
                dataStream.write({
                  type: "data-reasoning",
                  data: reasoningText,
                });
              }
            } else if (part.type === "text-delta") {
              const delta = (part as { text?: string }).text;
              if (delta) {
                // First text-delta after reasoning means reasoning is complete
                if (reasoningText.length > 0 && planningText.length === 0) {
                  dataStream.write({
                    type: "data-reasoningComplete",
                    data: true,
                  });
                }
                // Accumulate and stream the planning code
                planningText += delta;
                dataStream.write({
                  type: "data-debugCode",
                  data: planningText,
                });
              }
            }
          }

          // Track AI call for cost estimation (planning)
          aiCallCount++;

          planningText = planningText.trim();
          console.log("[chat-api] planning response (truncated)", {
            chatId: id,
            preview: planningText.slice(0, 400),
          });
          let codeBlock = extractCodeBlock(planningText);

          // ===========================================================
          // TWO-STEP DISCOVERY: No code block needed for discovery phase
          // ===========================================================
          // With two-step discovery, we directly search the marketplace and
          // ask the AI to select tools - no code generation required.
          // Skip straight to the discovery flow below.

          // ===========================================================
          // EXECUTION PHASE VALIDATION: Prevent hallucination
          // ===========================================================
          // If in execution phase and no code block was generated, the AI
          // is trying to answer directly instead of using the paid/free tools.
          // We must retry with a stronger prompt to force code generation.
          const MAX_EXECUTION_RETRIES = 2;
          if (isAutoModeExecution && autoModePayment && !codeBlock) {
            console.warn(
              "[chat-api] Auto Mode Execution: AI did not generate code block, retrying",
              {
                chatId: id,
                responsePreview: planningText.slice(0, 200),
                selectedTools: autoModePayment.selectedTools.map((t) => t.name),
              }
            );

            for (
              let executionRetry = 0;
              executionRetry < MAX_EXECUTION_RETRIES && !codeBlock;
              executionRetry++
            ) {
              // Build tool list for the retry prompt
              const toolList = autoModePayment.selectedTools
                .map((t) => `- ${t.name} (toolId: ${t.toolId})`)
                .join("\n");

              // Build a stronger retry prompt
              const retryPrompt = `You MUST respond with a TypeScript code block. Your previous response did not contain code.

CRITICAL: You are in EXECUTION PHASE. The user has PAID for these tools:
${toolList}

You MUST generate code that:
1. Imports callMcpSkill from "@/lib/ai/skills/mcp"
2. Calls the paid/free tools to fetch data
3. Returns a result object

If the selected tools cannot answer the user's question, you MUST STILL generate code that:
- Attempts to use the tools
- Returns { error: "explanation of why tools cannot answer this query" }

DO NOT respond with plain text. ONLY output a \`\`\`ts code block.

The user asked: "${message.parts
                .filter(
                  (p): p is { type: "text"; text: string } => p.type === "text"
                )
                .map((p) => p.text)
                .join(" ")}"`;

              const retryResult = await generateText({
                model: provider.languageModel(selectedChatModel),
                system: planningSystemInstructions,
                messages: [
                  ...baseModelMessages,
                  { role: "assistant" as const, content: planningText },
                  { role: "user" as const, content: retryPrompt },
                ],
              });

              // Track AI call for cost estimation (retry)
              aiCallCount++;

              const retryCode = extractCodeBlock(retryResult.text);
              if (retryCode) {
                console.log("[chat-api] Auto Mode Execution: retry succeeded", {
                  chatId: id,
                  attempt: executionRetry + 1,
                  codePreview: retryCode.slice(0, 100),
                });
                codeBlock = retryCode;
                planningText = retryResult.text;
              } else {
                console.warn(
                  "[chat-api] Auto Mode Execution: retry failed to produce code",
                  {
                    chatId: id,
                    attempt: executionRetry + 1,
                  }
                );
              }
            }

            // If still no code block after retries, signal error and return
            if (!codeBlock) {
              console.error(
                "[chat-api] Auto Mode Execution: failed to generate code after retries",
                { chatId: id }
              );

              dataStream.write({
                type: "data-toolStatus",
                data: { status: "thinking" },
              });

              // Return an error - don't let the AI hallucinate
              dataStream.write({
                type: "data-error",
                data: {
                  message:
                    "The selected tools could not be used for this query. Please try a different question or select different tools.",
                },
              });
              return;
            }
          }

          let mediatorText =
            "No tool execution was required for this turn. Respond directly to the user.";
          // Keep track of the last execution payload so we can optionally
          // surface it inline in the final markdown response for Developer
          // Mode. This stays server-side and is only exposed to the model
          // when isDebugMode is true.
          let executionPayload: string | undefined;
          let executionStatus: ExecutionStatus = "not_executed";
          let executionHasData = false;

          if (codeBlock) {
            if (process.env.NODE_ENV === "development") {
              console.log("[chat-api] planning extracted code block", {
                chatId: id,
                isDebugMode,
                codePreview: codeBlock.slice(0, 160),
              });
            }
            console.log("[chat-api] extracted code block, analyzing imports", {
              chatId: id,
            });

            // Signal execution status - ensures UI shows "Executing..." immediately
            dataStream.write({
              type: "data-toolStatus",
              data: { status: "executing" },
            });
            await new Promise((resolve) => setTimeout(resolve, 10));

            const modulesUsed = findImportedModules(codeBlock);

            if (modulesUsed.length === 0) {
              console.warn(
                "[chat-api] generated code did not import any approved skills; falling back to direct answer",
                { chatId: id }
              );
            } else {
              const allowedModules = new Set<AllowedModule>();
              const paidModulesUsed = new Set<PaidToolContext>();

              for (const moduleName of modulesUsed) {
                if (paidToolModuleMap.has(moduleName)) {
                  const contexts = paidToolModuleMap.get(moduleName);
                  if (contexts && contexts.length > 0) {
                    allowedModules.add(moduleName);
                    for (const context of contexts) {
                      paidModulesUsed.add(context);
                    }
                  } else {
                    throw new ChatSDKError(
                      "bad_request:chat",
                      `Module ${moduleName} is not available for this request.`
                    );
                  }
                } else if (BUILTIN_MODULE_SET.has(moduleName)) {
                  allowedModules.add(moduleName);
                } else if (isAutoMode && moduleName === MCP_TOOL_MODULE) {
                  // In Auto Mode, allow MCP module for discovered tools
                  // callMcpSkill will handle authorization and cost tracking
                  allowedModules.add(moduleName);
                  console.log(
                    "[chat-api] Auto Mode: allowing MCP module for dynamic tool discovery"
                  );
                } else {
                  throw new ChatSDKError(
                    "forbidden:chat",
                    `Module ${moduleName} is not authorized for this turn.`
                  );
                }
              }

              if (allowedModules.size === 0) {
                console.warn(
                  "[chat-api] no authorized skills found after filtering; falling back to direct answer",
                  { chatId: id }
                );
              } else if (isAutoModeExecution && autoModePayment) {
                // ===========================================================
                // AUTO MODE EXECUTION PHASE: After payment confirmed
                // ===========================================================
                // Payment has been received - verify and execute tools

                console.log(
                  "[chat-api] Auto Mode Execution: verifying payment",
                  {
                    chatId: id,
                    txHash: autoModePayment.transactionHash,
                    toolCount: autoModePayment.selectedTools.length,
                  }
                );

                // Verify payment on-chain
                const expectedTools = autoModePayment.selectedTools.map(
                  (t) => ({
                    toolId: t.toolId,
                    developerAddress: "", // Will be fetched below
                  })
                );

                // Fetch developer wallets for verification
                for (const tool of expectedTools) {
                  const dbTool = await getAIToolById({ id: tool.toolId });
                  if (dbTool) {
                    tool.developerAddress = dbTool.developerWallet;
                  }
                }

                const verification = await verifyBatchPayment(
                  autoModePayment.transactionHash as `0x${string}`,
                  expectedTools
                );

                if (!verification.isValid) {
                  console.error(
                    "[chat-api] Auto Mode Execution: payment verification failed",
                    {
                      chatId: id,
                      error: verification.error,
                    }
                  );
                  throw new ChatSDKError(
                    "bad_request:chat",
                    verification.error || "Payment verification failed."
                  );
                }

                console.log(
                  "[chat-api] Auto Mode Execution: payment verified, executing",
                  {
                    chatId: id,
                  }
                );

                // Build the allowed tools map from selected tools
                const autoModeAllowedTools = new Map<
                  string,
                  AllowedToolContext
                >();
                for (const selectedTool of autoModePayment.selectedTools) {
                  const dbTool = await getAIToolById({
                    id: selectedTool.toolId,
                  });
                  if (dbTool) {
                    autoModeAllowedTools.set(selectedTool.toolId, {
                      tool: dbTool,
                      transactionHash: autoModePayment.transactionHash,
                      executionCount: 0,
                    });
                  }
                }

                // =============================================================
                // AGENTIC EXECUTION WITH SELF-HEALING (shared function)
                // =============================================================
                // Execute code with automatic error correction and reflection
                console.log(
                  "[chat-api] Auto Mode: starting agentic execution",
                  {
                    chatId: id,
                    toolCount: autoModeAllowedTools.size,
                  }
                );

                const agenticResult = await executeWithSelfHealing({
                  initialCode: codeBlock,
                  allowedModules: Array.from(allowedModules),
                  allowedTools: autoModeAllowedTools,
                  dataStream,
                  getLanguageModel: () =>
                    provider.languageModel(selectedChatModel),
                  session,
                  chatId: id,
                  isAutoMode: true,
                });

                const execution = agenticResult.execution;

                if (execution.ok) {
                  executionStatus = "success";
                  executionHasData = hasNonEmptyData(execution.data);
                  executionPayload = formatExecutionData(execution.data);
                } else {
                  executionStatus = "failed";
                  executionHasData = false;
                  executionPayload = formatExecutionData({
                    error: execution.error,
                    logs: execution.logs,
                  });
                }

                dataStream.write({
                  type: "data-debugResult",
                  data: executionPayload,
                });

                // Record tool queries with payment
                for (const selectedTool of autoModePayment.selectedTools) {
                  const dbTool = await getAIToolById({
                    id: selectedTool.toolId,
                  });
                  if (dbTool) {
                    await recordToolQuery({
                      toolId: selectedTool.toolId,
                      userId: session.user.id,
                      chatId: id,
                      amountPaid: selectedTool.price,
                      transactionHash: autoModePayment.transactionHash,
                      queryOutput: execution.ok
                        ? (execution.data as Record<string, unknown>)
                        : undefined,
                      status: execution.ok ? "completed" : "failed",
                    });
                  }
                }

                dataStream.write({
                  type: "data-toolStatus",
                  data: { status: "thinking" },
                });

                // Build mediator text with retry info for transparency
                mediatorText = buildMediatorText(
                  execution,
                  agenticResult.attemptCount,
                  Array.from(allowedModules),
                  executionHasData
                );

                // Add payment verification note for auto mode
                if (execution.ok) {
                  mediatorText = mediatorText.replace(
                    "Tool execution succeeded.",
                    "Tool execution succeeded (payment verified)."
                  );
                }
              } else {
                // ===========================================================
                // MANUAL MODE: Payment verification + Agentic Execution
                // ===========================================================
                // Now includes self-healing for manual mode too!
                const verifiedSkillContexts: PaidToolContext[] = [];
                for (const context of paidModulesUsed) {
                  const verification = await verifyPayment(
                    context.transactionHash as `0x${string}`,
                    context.tool.id,
                    context.tool.developerWallet
                  );
                  if (!verification.isValid) {
                    console.warn("[chat-api] payment verification failed", {
                      chatId: id,
                      toolId: context.tool.id,
                      tx: context.transactionHash,
                      error: verification.error,
                    });
                    throw new ChatSDKError(
                      "bad_request:chat",
                      verification.error || "Payment verification failed."
                    );
                  }
                  verifiedSkillContexts.push(context);
                }

                const allowedToolMap = buildAllowedToolRuntimeMap(paidTools);

                console.log(
                  "[chat-api] Manual Mode: starting agentic execution with self-healing",
                  {
                    chatId: id,
                    allowedModules: Array.from(allowedModules),
                    httpTools: Array.from(allowedToolMap.keys()),
                  }
                );

                // =============================================================
                // AGENTIC EXECUTION WITH SELF-HEALING (shared function)
                // =============================================================
                // Manual mode now gets the same self-healing as auto mode!
                // User already paid, so we must try to deliver results.
                const agenticResult = await executeWithSelfHealing({
                  initialCode: codeBlock,
                  allowedModules: Array.from(allowedModules),
                  allowedTools: allowedToolMap,
                  dataStream,
                  getLanguageModel: () =>
                    provider.languageModel(selectedChatModel),
                  session,
                  chatId: id,
                  isAutoMode: false, // Manual mode
                });

                const execution = agenticResult.execution;

                if (execution.ok) {
                  executionStatus = "success";
                  executionHasData = hasNonEmptyData(execution.data);
                  executionPayload = formatExecutionData(execution.data);
                } else {
                  executionStatus = "failed";
                  executionHasData = false;
                  executionPayload = formatExecutionData({
                    error: execution.error,
                    logs: execution.logs,
                  });
                }

                // Stream execution result to client for Developer Mode display
                dataStream.write({
                  type: "data-debugResult",
                  data: executionPayload,
                });

                if (process.env.NODE_ENV === "development") {
                  console.log("[chat-api] execution payload constructed", {
                    chatId: id,
                    payloadLength: executionPayload?.length,
                    hasData: executionHasData,
                    status: executionStatus,
                    preview: executionPayload?.slice(0, 200),
                    attemptCount: agenticResult.attemptCount,
                  });
                  if (execution.ok) {
                    console.log(
                      "[chat-api] full execution data:",
                      JSON.stringify(execution.data, null, 2)
                    );
                  }
                }

                for (const context of verifiedSkillContexts) {
                  await recordToolQuery({
                    toolId: context.tool.id,
                    userId: session.user.id,
                    chatId: id,
                    amountPaid: context.tool.pricePerQuery,
                    transactionHash: context.transactionHash,
                    queryOutput: execution.ok
                      ? (execution.data as Record<string, unknown>)
                      : undefined,
                    status: execution.ok ? "completed" : "failed",
                  });
                }

                if (!execution.ok) {
                  console.error(
                    "[chat-api] skill execution failed after self-healing attempts",
                    {
                      chatId: id,
                      error: execution.error,
                      logs: execution.logs,
                      code: codeBlock,
                      attemptCount: agenticResult.attemptCount,
                    }
                  );
                }

                // Build mediator text with retry info for transparency
                mediatorText = buildMediatorText(
                  execution,
                  agenticResult.attemptCount,
                  Array.from(allowedModules),
                  executionHasData
                );

                console.log("[chat-api] execution finished", {
                  chatId: id,
                  ok: execution.ok,
                  attemptCount: agenticResult.attemptCount,
                });

                // Signal thinking status for final response
                dataStream.write({
                  type: "data-toolStatus",
                  data: { status: "thinking" },
                });
                await new Promise((resolve) => setTimeout(resolve, 10));
              }
            }
          }

          const mediatorMessage: ChatMessage = {
            id: generateUUID(),
            role: "assistant",
            parts: [
              {
                type: "text",
                text: `[[EXECUTION SUMMARY]]\n${mediatorText}`,
              },
            ],
          };

          console.log("[chat-api] mediator message (truncated)", {
            chatId: id,
            preview:
              mediatorMessage.parts[0]?.type === "text"
                ? (mediatorMessage.parts[0].text as string).slice(0, 400)
                : null,
          });

          const finalMessages = convertToModelMessages([
            ...uiMessages,
            mediatorMessage,
          ]);

          console.log("[chat-api] starting final response stream", {
            chatId: id,
            messageCount: finalMessages.length,
          });

          // When Developer Mode is enabled, we want a *single* assistant
          // message that contains:
          //   1) The TypeScript plan in a fenced ```ts block
          //   2) The raw execution result (or error/logs) in a fenced ```json block
          //   3) The natural-language answer
          //
          // To preserve the template's markdown rendering and styling, we
          // instruct the model to emit these blocks inline in the final
          // response instead of sending them as separate debug streams.
          //
          // When Developer Mode is disabled, we keep the original behavior
          // and explicitly tell the model *not* to surface TS/JSON.
          const devPrefix =
            isDebugMode && codeBlock && executionPayload
              ? `

At the very top of your answer, before any prose, you **MUST** output the following two markdown blocks exactly as shown. Do not merge them or change their content.

Block 1 (TypeScript Plan):
\`\`\`ts
${codeBlock}
\`\`\`

Block 2 (Execution Result):
\`\`\`json
${executionPayload}
\`\`\`

After these two blocks and a blank line, write your natural language explanation as described below.
`
              : `

Do NOT show TypeScript code or the raw JSON unless the user explicitly asks to see it.
`;

          const answerSystemInstructions = `${regularPrompt}

You are responding to the user *after* tools have already been executed.

You will see an internal assistant message that starts with "[[EXECUTION SUMMARY]]" and contains a JSON summary of the tool results.

- Use that summary (and the full conversation) to answer the user's question in clear, natural language.
- Instead, explain the key findings, numbers, and rankings in a concise way.
- If relevant, mention which tools you used conceptually (e.g. "using on-chain gas data") without exposing implementation details.
- If the result includes a saved file URL (blob.vercel-storage.com), do NOT write the URL in your response. The UI automatically displays a download card. Simply mention that the data was saved.

Anti-Hallucination Rules:
- Any chains, chain IDs, gas prices, or other numeric values you mention **MUST** appear explicitly in the JSON in the execution summary.
- If the EXECUTION SUMMARY includes \`HAS_DATA: false\` or a \`STATUS\` other than \`"success"\`, you **MUST** clearly say that no reliable data is available and you **MUST NOT** guess or invent values (numbers, prices, chain names, rankings, etc.).
- If there is no usable data, explain that limitation (e.g. the tool returned no results or an error) instead of answering as if you had real numbers.
${devPrefix}`;

          const result = streamText({
            model: provider.languageModel(selectedChatModel),
            system: answerSystemInstructions,
            messages: finalMessages,
            stopWhen: stepCountIs(5),
            experimental_transform: smoothStream({ chunking: "word" }),
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: "stream-text",
            },
            onFinish: async ({ usage }) => {
              // Track AI call for cost estimation (final response)
              aiCallCount++;
              try {
                const providers = await getTokenlensCatalog();
                const modelId =
                  provider.languageModel(selectedChatModel).modelId;
                if (!modelId) {
                  finalMergedUsage = usage;
                  dataStream.write({
                    type: "data-usage",
                    data: finalMergedUsage,
                  });
                  return;
                }

                if (!providers) {
                  finalMergedUsage = usage;
                  dataStream.write({
                    type: "data-usage",
                    data: finalMergedUsage,
                  });
                  return;
                }

                const summary = getUsage({ modelId, usage, providers });
                finalMergedUsage = {
                  ...usage,
                  ...summary,
                  modelId,
                } as AppUsage;
                // Track actual cost for dynamic estimation
                if (finalMergedUsage.costUSD?.totalUSD) {
                  totalActualCost += Number(finalMergedUsage.costUSD.totalUSD);
                }
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
              } catch (err) {
                console.warn("TokenLens enrichment failed", err);
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
              }
            },
          });

          result.consumeStream();

          dataStream.merge(
            result.toUIMessageStream({
              sendReasoning: true,
            })
          );
        } catch (error) {
          console.error("[chat-api] error in paid tools branch", {
            chatId: id,
            error,
          });
          throw error;
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((currentMessage) => ({
            id: currentMessage.id,
            role: currentMessage.role,
            parts: currentMessage.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        // === TIER SYSTEM: Track usage ===
        if (userTier === "free") {
          await incrementFreeQueriesUsed(session.user.id);
        }

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });

            // Track actual cost for convenience tier
            const actualCost =
              totalActualCost > 0
                ? totalActualCost
                : finalMergedUsage.costUSD?.totalUSD !== undefined
                  ? Number(finalMergedUsage.costUSD.totalUSD)
                  : 0;

            if (userTier === "convenience" && actualCost > 0) {
              await addAccumulatedModelCost(session.user.id, actualCost);

              // Record cost for dynamic estimation feedback loop
              await recordActualCost({
                userId: session.user.id,
                chatId: id,
                modelId: selectedChatModel,
                flowType,
                estimatedCost: estimatedTotalCost,
                actualCost,
                aiCallCount,
              });
            }
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
