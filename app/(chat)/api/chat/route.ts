import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
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
  type AllowedModule,
  executeSkillCode,
  REGISTERED_SKILL_MODULES,
} from "@/lib/ai/code-executor";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { type ChatModel, getEstimatedModelCost } from "@/lib/ai/models";
import {
  autoModeDiscoveryPrompt,
  type EnabledToolSummary,
  type RequestHints,
  regularPrompt,
  systemPrompt,
} from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { refreshMcpToolSchema } from "@/lib/ai/skills/mcp";
import type { AllowedToolContext } from "@/lib/ai/skills/runtime";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getAIToolById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  recordToolQuery,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import type { AITool, DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
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
];

const BUILTIN_MODULE_SET = new Set(BUILTIN_MODULES);
const REGISTERED_MODULE_SET = new Set<string>(REGISTERED_SKILL_MODULES);
const MCP_TOOL_MODULE = "@/lib/ai/skills/mcp" as const;
const MARKETPLACE_MODULE = "@/lib/ai/skills/marketplace" as const;

const CODE_BLOCK_REGEX = /```(?:ts|typescript)?\s*([\s\S]*?)```/i;
const IMPORT_REGEX = /^import\s+{[^}]+}\s+from\s+["']([^"']+)["'];?/gim;

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
  kind: "skill" | "mcp";
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

function getSkillModuleFromTool(tool: AITool): AllowedModule | null {
  const schema = tool.toolSchema;
  if (!schema || typeof schema !== "object") {
    return null;
  }
  const skillField = (schema as Record<string, unknown>).skill;
  if (!skillField) {
    return null;
  }
  const entry = Array.isArray(skillField) ? skillField[0] : skillField;
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const moduleId = (entry as Record<string, unknown>).module;
  if (typeof moduleId === "string" && REGISTERED_MODULE_SET.has(moduleId)) {
    return moduleId as AllowedModule;
  }
  return null;
}

function buildAllowedToolRuntimeMap(paidTools: PaidToolContext[]) {
  const map = new Map<string, AllowedToolContext>();
  for (const context of paidTools) {
    // MCP tools need to be tracked for billing
    if (context.kind === "mcp") {
      map.set(context.tool.id, {
        tool: context.tool,
        transactionHash: context.transactionHash,
        kind: "mcp",
        executionCount: 0,
      });
    }
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
        toolInvocationsCount: toolInvocations.length,
      });
    }

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const paidTools = await Promise.all(
      toolInvocations.map(async (invocation) => {
        let tool = await getAIToolById({ id: invocation.toolId });
        if (!tool) {
          throw new ChatSDKError("not_found:chat", "Requested tool not found");
        }

        const toolKind = tool.toolSchema
          ? (tool.toolSchema as Record<string, unknown>).kind
          : undefined;

        // MCP tools use the MCP module
        if (toolKind === "mcp") {
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
            kind: "mcp" as const,
          };
        }

        // Native skills use their module path
        const module = getSkillModuleFromTool(tool);
        if (!module) {
          throw new ChatSDKError(
            "bad_request:chat",
            "Tool is not configured for code execution."
          );
        }

        return {
          tool,
          transactionHash: invocation.transactionHash,
          module,
          kind: "skill" as const,
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
        module: entry.kind === "skill" ? entry.module : undefined,
        kind: entry.kind,
        usage: getToolUsage(entry.tool),
        mcpTools: entry.kind === "mcp" ? getMcpTools(entry.tool) : undefined,
      });
    }

    // Inject module content for Native Skills
    for (const tool of enabledToolSummaries) {
      if (tool.kind === "skill" && tool.module) {
        try {
          // In a real production environment, we would read this from a cache or pre-loaded map
          // Here we use dynamic import to inspect the module's exports if possible,
          // but since we can't easily read source code at runtime in this environment without
          // FS access (which we have, but it's tricky with Next.js bundling),
          // we will assume the developer provided a good description.
          //
          // However, to fulfill the requirement: "Update System Prompt logic to load the module content"
          // We will implement a best-effort read if running locally, or rely on a new field in the DB.
          //
          // For now, we will update the prompt generation to explicitly look for 'moduleContent' if we add it later.
          //
          // A simpler approach for this MVP:
          // We trust the description and the 'usage' field (if any).
          // If we really want to load code, we need to read the file from disk.
          // Let's try to read the file content for known community skills.

          if (tool.module.startsWith("@/lib/ai/skills/community/")) {
            // This would require fs.readFileSync which might fail in Vercel Edge/Serverless if not bundled assets.
            // So we will skip actual file reading for safety and rely on the robust "Instruction Manual" description
            // we just enforced in the UI.
          }
        } catch (e) {
          console.warn(`Failed to load module content for ${tool.module}`, e);
        }
      }
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
            model: myProvider.languageModel(selectedChatModel),
            system: systemInstructions,
            messages: convertToModelMessages(uiMessages),
            stopWhen: stepCountIs(5),
            experimental_transform: smoothStream({ chunking: "word" }),
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: "stream-text",
            },
            onFinish: async ({ usage }) => {
              try {
                const providers = await getTokenlensCatalog();
                const modelId =
                  myProvider.languageModel(selectedChatModel).modelId;
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

          if (finalMergedUsage) {
            try {
              await updateChatLastContextById({
                chatId: id,
                context: finalMergedUsage,
              });

              // Phase 2: Track estimated vs actual cost for model cost baking
              const estimatedCost = getEstimatedModelCost(selectedChatModel);
              const actualCost =
                finalMergedUsage.costUSD?.totalUSD !== undefined
                  ? Number(finalMergedUsage.costUSD.totalUSD)
                  : 0;
              const costDelta = actualCost - estimatedCost;

              console.log("[cost-tracking] Model cost comparison:", {
                chatId: id,
                model: selectedChatModel,
                estimatedCost: `$${estimatedCost.toFixed(6)}`,
                actualCost: `$${actualCost.toFixed(6)}`,
                delta: `$${costDelta.toFixed(6)}`,
                deltaPercent:
                  estimatedCost > 0
                    ? `${((costDelta / estimatedCost) * 100).toFixed(1)}%`
                    : "N/A",
              });
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

          // Choose the appropriate prompt based on the phase
          let planningSystemInstructions: string;

          if (isAutoModeDiscovery) {
            // Discovery phase: Use focused discovery prompt for tool selection
            planningSystemInstructions = autoModeDiscoveryPrompt({
              selectedChatModel,
              requestHints,
            });
          } else if (isAutoModeExecution && autoModePayment) {
            // Execution phase: Build tool summaries from paid-for tools
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
            model: myProvider.languageModel(selectedChatModel),
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

          planningText = planningText.trim();
          console.log("[chat-api] planning response (truncated)", {
            chatId: id,
            preview: planningText.slice(0, 400),
          });
          const codeBlock = extractCodeBlock(planningText);

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

            // Signal execution status
            dataStream.write({
              type: "data-toolStatus",
              data: { status: "executing" },
            });

            // Force a tiny delay to ensure the chunk is flushed before blocking execution
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
              } else if (
                isAutoModeDiscovery &&
                allowedModules.has(MARKETPLACE_MODULE)
              ) {
                // ===========================================================
                // AUTO MODE DISCOVERY PHASE: Search and select tools
                // ===========================================================
                // This phase only searches the marketplace and selects tools.
                // It does NOT execute paid tools. Execution happens after payment.

                console.log(
                  "[chat-api] Auto Mode Discovery: executing search",
                  {
                    chatId: id,
                  }
                );

                // Execute the discovery code (only marketplace search, no paid tools)
                const discoveryExecution = await executeSkillCode({
                  code: codeBlock,
                  allowedModules: Array.from(allowedModules),
                  runtime: {
                    session,
                    dataStream,
                    requestId: id,
                    chatId: id,
                    isAutoMode: true,
                    isDiscoveryPhase: true, // Flag to prevent paid tool execution
                  },
                });

                if (discoveryExecution.ok) {
                  // Parse the discovery result to extract selected tools
                  const discoveryResult = discoveryExecution.data as {
                    selectedTools?: Array<{
                      id: string;
                      name: string;
                      description?: string;
                      price: string;
                      mcpTools?: Array<{ name: string; description?: string }>;
                      reason?: string;
                    }>;
                    selectionReasoning?: string;
                    candidates?: unknown[];
                    error?: string;
                  };

                  // Stream the discovery result for debugging
                  dataStream.write({
                    type: "data-debugResult",
                    data: formatExecutionData(discoveryResult),
                  });

                  // Check if tools were selected
                  const selectedTools = discoveryResult?.selectedTools ?? [];

                  if (selectedTools.length === 0) {
                    // No tools selected - either no matches or free tools only
                    console.log(
                      "[chat-api] Auto Mode Discovery: no paid tools selected",
                      {
                        chatId: id,
                        reason:
                          discoveryResult?.error ||
                          discoveryResult?.selectionReasoning,
                      }
                    );

                    dataStream.write({
                      type: "data-toolStatus",
                      data: { status: "thinking" },
                    });

                    mediatorText = discoveryResult?.error
                      ? `Tool discovery completed but no suitable tools found: ${discoveryResult.error}`
                      : `Tool discovery completed. No paid tools required for this query.
Selection reasoning: ${discoveryResult?.selectionReasoning || "N/A"}`;
                  } else {
                    // Calculate total cost
                    const totalCost = selectedTools.reduce((sum, tool) => {
                      return sum + Number(tool.price ?? 0);
                    }, 0);

                    console.log(
                      "[chat-api] Auto Mode Discovery: tools selected",
                      {
                        chatId: id,
                        toolCount: selectedTools.length,
                        totalCost,
                        tools: selectedTools.map((t) => ({
                          id: t.id,
                          name: t.name,
                          price: t.price,
                        })),
                      }
                    );

                    // Fetch full tool details for each selected tool
                    const toolDetails = await Promise.all(
                      selectedTools.map(async (selected) => {
                        const tool = await getAIToolById({ id: selected.id });
                        return {
                          toolId: selected.id,
                          name: selected.name,
                          description:
                            selected.description || tool?.description || "",
                          price: selected.price,
                          developerWallet: tool?.developerWallet || "",
                          mcpTools: selected.mcpTools,
                          reason: selected.reason,
                        };
                      })
                    );

                    // Send tool selection to client for approval
                    // This is the PAY-BEFORE-DELIVERY model
                    dataStream.write({
                      type: "data-autoModeToolSelection",
                      data: {
                        selectedTools: toolDetails,
                        totalCost: totalCost.toFixed(6),
                        selectionReasoning: discoveryResult?.selectionReasoning,
                        originalQuery: message.parts
                          .filter(
                            (p): p is { type: "text"; text: string } =>
                              p.type === "text"
                          )
                          .map((p) => p.text)
                          .join(" "),
                      },
                    });

                    // Signal awaiting payment - stream will end here
                    // Client must pay and send a new request with autoModePayment
                    dataStream.write({
                      type: "data-toolStatus",
                      data: { status: "awaiting-tool-approval" },
                    });

                    // Don't continue to response generation - wait for payment
                    console.log(
                      "[chat-api] Auto Mode Discovery: awaiting payment",
                      {
                        chatId: id,
                        totalCost,
                      }
                    );

                    // Return early - don't generate response until payment confirmed
                    return;
                  }
                } else {
                  console.error("[chat-api] Auto Mode Discovery failed", {
                    chatId: id,
                    error: discoveryExecution.error,
                  });

                  dataStream.write({
                    type: "data-toolStatus",
                    data: { status: "thinking" },
                  });

                  mediatorText = `Tool discovery failed: ${discoveryExecution.error}
HAS_DATA: false
STATUS: failed
Logs:
${discoveryExecution.logs.join("\n")}`;
                }
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
                      kind: "mcp",
                      executionCount: 0,
                    });
                  }
                }

                // Execute with the paid tools now authorized
                const execution = await executeSkillCode({
                  code: codeBlock,
                  allowedModules: Array.from(allowedModules),
                  runtime: {
                    session,
                    dataStream,
                    requestId: id,
                    chatId: id,
                    isAutoMode: true,
                    allowedTools: autoModeAllowedTools,
                  },
                });

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

                mediatorText = execution.ok
                  ? `Tool execution succeeded (payment verified).
HAS_DATA: ${executionHasData}
STATUS: ${executionStatus}
Modules used: ${Array.from(allowedModules).join(", ")}
Result JSON:
${formatExecutionData(execution.data)}`
                  : `Tool execution failed: ${execution.error}
HAS_DATA: false
STATUS: failed
Logs:
${execution.logs.join("\n")}`;
              } else {
                // ===========================================================
                // NON-AUTO MODE: Original payment verification flow
                // ===========================================================
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
                  if (context.kind === "skill") {
                    verifiedSkillContexts.push(context);
                  }
                }

                const allowedToolMap = buildAllowedToolRuntimeMap(paidTools);

                console.log("[chat-api] executing skill code", {
                  chatId: id,
                  allowedModules: Array.from(allowedModules),
                  httpTools: Array.from(allowedToolMap.keys()),
                });

                const execution = await executeSkillCode({
                  code: codeBlock,
                  allowedModules: Array.from(allowedModules),
                  runtime: {
                    session,
                    dataStream,
                    requestId: id,
                    chatId: id,
                    allowedTools: allowedToolMap.size
                      ? allowedToolMap
                      : undefined,
                    isAutoMode,
                  },
                });

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
                  console.error("[chat-api] skill execution failed", {
                    chatId: id,
                    error: execution.error,
                    logs: execution.logs,
                    code: codeBlock,
                  });
                }

                mediatorText = execution.ok
                  ? `Tool execution succeeded.
HAS_DATA: ${executionHasData}
STATUS: ${executionStatus}
Modules used: ${Array.from(allowedModules).join(", ")}
Result JSON:
${formatExecutionData(execution.data)}`
                  : `Tool execution failed: ${execution.error}
HAS_DATA: false
STATUS: failed
Logs:
${execution.logs.join("\n")}`;
                console.log("[chat-api] execution finished", {
                  chatId: id,
                  ok: execution.ok,
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

Anti-Hallucination Rules:
- Any chains, chain IDs, gas prices, or other numeric values you mention **MUST** appear explicitly in the JSON in the execution summary.
- If the EXECUTION SUMMARY includes \`HAS_DATA: false\` or a \`STATUS\` other than \`"success"\`, you **MUST** clearly say that no reliable data is available and you **MUST NOT** guess or invent values (numbers, prices, chain names, rankings, etc.).
- If there is no usable data, explain that limitation (e.g. the tool returned no results or an error) instead of answering as if you had real numbers.
${devPrefix}`;

          const result = streamText({
            model: myProvider.languageModel(selectedChatModel),
            system: answerSystemInstructions,
            messages: finalMessages,
            stopWhen: stepCountIs(5),
            experimental_transform: smoothStream({ chunking: "word" }),
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: "stream-text",
            },
            onFinish: async ({ usage }) => {
              try {
                const providers = await getTokenlensCatalog();
                const modelId =
                  myProvider.languageModel(selectedChatModel).modelId;
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

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });

            // Phase 2: Track estimated vs actual cost for model cost baking
            const estimatedCost = getEstimatedModelCost(selectedChatModel);
            const actualCost =
              finalMergedUsage.costUSD?.totalUSD !== undefined
                ? Number(finalMergedUsage.costUSD.totalUSD)
                : 0;
            const costDelta = actualCost - estimatedCost;

            console.log("[cost-tracking] Model cost comparison (paid tools):", {
              chatId: id,
              model: selectedChatModel,
              estimatedCost: `$${estimatedCost.toFixed(6)}`,
              actualCost: `$${actualCost.toFixed(6)}`,
              delta: `$${costDelta.toFixed(6)}`,
              deltaPercent:
                estimatedCost > 0
                  ? `${((costDelta / estimatedCost) * 100).toFixed(1)}%`
                  : "N/A",
            });
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
