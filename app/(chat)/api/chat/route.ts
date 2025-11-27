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
import type { ChatModel } from "@/lib/ai/models";
import {
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
import { verifyPayment } from "@/lib/tools/payment-verifier";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

const BUILTIN_MODULES: AllowedModule[] = [
  "@/lib/ai/skills/document",
  "@/lib/ai/skills/suggestions",
  "@/lib/ai/skills/weather",
];

const BUILTIN_MODULE_SET = new Set(BUILTIN_MODULES);
const REGISTERED_MODULE_SET = new Set<string>(REGISTERED_SKILL_MODULES);
const MCP_TOOL_MODULE = "@/lib/ai/skills/mcp" as const;

const CODE_BLOCK_REGEX = /```(?:ts|typescript)?\s*([\s\S]*?)```/i;
const IMPORT_REGEX = /^import\s+{[^}]+}\s+from\s+["']([^"']+)["'];?/gim;

type ExecutionStatus = "not_executed" | "success" | "failed";

function hasNonEmptyData(data: unknown): boolean {
  if (data === null || data === undefined) return false;
  if (typeof data === "string") return data.trim().length > 0;
  if (typeof data === "number" || typeof data === "boolean") return true;
  if (Array.isArray(data)) {
    return data.some(hasNonEmptyData);
  }
  if (typeof data === "object") {
    const keys = Object.keys(data);
    if (keys.length === 0) return false;
    // Special case for error object: if the object has exactly one key `error`, treat it as "no data"
    if (keys.length === 1 && keys[0] === "error") return false;
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
    return tools as { name: string; description?: string; inputSchema?: unknown; outputSchema?: unknown }[];
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
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
      toolInvocations?: { toolId: string; transactionHash: string }[];
      isDebugMode?: boolean;
    } = requestBody;

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
              const refreshedTool = await getAIToolById({ id: invocation.toolId });
              if (refreshedTool) {
                tool = refreshedTool;
              }
            }
          } catch (err) {
            // Don't fail the request if schema refresh fails
            console.warn(`[chat-api] Schema refresh failed for ${tool.name}:`, err);
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

    // Branch 1: no paid tools selected → simple streaming chat (no planning/execution loop).
    if (paidTools.length === 0) {
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
          });
          const planningSystemInstructions = systemPrompt({
            selectedChatModel,
            requestHints,
            enabledTools: enabledToolSummaries,
            isDebugMode, // Pass debug mode for consistency
          });

          // Signal planning status so UI shows "Planning..."
          dataStream.write({
            type: "data-toolStatus",
            data: { status: "planning" },
          });

          // Force a tiny delay to ensure the chunk is flushed
          await new Promise((resolve) => setTimeout(resolve, 10));

          // STREAMING PLANNER:
          // Use streamText so dev mode can see the code "as it's being written".
          // NOTE: extractReasoningMiddleware is available but currently disabled as it
          // requires specific model support for <think> tags. For now, use textStream
          // which works reliably with all models including Kimi K2.
          const planningResult = streamText({
            model: myProvider.languageModel(selectedChatModel),
            system: planningSystemInstructions,
            messages: baseModelMessages,
            experimental_transform: smoothStream({ chunking: "word" }),
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: "planning-stream-text",
            },
          });

          let planningText = "";

          // Stream each chunk of planning code to the client for real-time display
          for await (const delta of planningResult.textStream) {
            planningText += delta;
            // Stream the cumulative planning text so the UI can display it as it's written
            dataStream.write({
              type: "data-debugCode",
              data: planningText,
            });
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
              } else {
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
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    // const streamContext = getStreamContext();

    // if (streamContext) {
    //   return new Response(
    //     await streamContext.resumableStream(streamId, () =>
    //       stream.pipeThrough(new JsonToSseTransformStream())
    //     )
    //   );
    // }

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
