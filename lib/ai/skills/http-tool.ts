import { getSkillRuntime } from "@/lib/ai/skills/runtime";
import { recordToolQuery } from "@/lib/db/queries";
import type { AITool } from "@/lib/db/schema";

type CallHttpToolParams = {
  toolId: string;
  input: Record<string, unknown>;
};

const HTTP_TIMEOUT_MS = 8_000;

export async function callHttpTool({ toolId, input }: CallHttpToolParams) {
  const runtime = getSkillRuntime();
  if (!runtime.allowedTools?.has(toolId)) {
    throw new Error(
      `Tool ${toolId} is not authorized for this turn. Ensure the user selected and paid for it.`
    );
  }

  const toolContext = runtime.allowedTools.get(toolId)!;

  if (toolContext.kind !== "http") {
    throw new Error("callHttpTool can only be used with HTTP tools.");
  }

  if (toolContext.hasExecuted) {
    throw new Error(
      "This HTTP tool has already been executed in this response. Create a new message to call it again."
    );
  }

  const endpoint = extractHttpEndpoint(toolContext.tool);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  const chatId = runtime.chatId ?? runtime.requestId;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Context-Tool-Id": toolId,
      },
      body: JSON.stringify({
        input,
        context: {
          chatId: runtime.chatId,
          requestId: runtime.requestId,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await safeReadText(response);
      throw new Error(
        `HTTP tool responded with ${response.status}: ${details.slice(0, 200)}`
      );
    }

    const payload = await safeReadJson(response);

    toolContext.hasExecuted = true;

    await recordToolQuery({
      toolId,
      userId: runtime.session.user.id,
      chatId,
      amountPaid: toolContext.tool.pricePerQuery,
      transactionHash: toolContext.transactionHash,
      queryInput: input,
      queryOutput: payload,
      status: "completed",
    });

    return payload;
  } catch (error) {
    toolContext.hasExecuted = true;
    await recordToolQuery({
      toolId,
      userId: runtime.session.user.id,
      chatId,
      amountPaid: toolContext.tool.pricePerQuery,
      transactionHash: toolContext.transactionHash,
      queryInput: input,
      status: "failed",
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractHttpEndpoint(tool: AITool): string {
  const schema = tool.toolSchema as Record<string, unknown> | null;
  const endpoint = schema && typeof schema === "object" ? schema["endpoint"] : undefined;

  if (typeof endpoint !== "string") {
    throw new Error(
      `Tool ${tool.name} is missing a valid HTTP endpoint in its schema.`
    );
  }

  return endpoint;
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function safeReadJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new Error("HTTP tool returned an invalid JSON response.");
  }
}

