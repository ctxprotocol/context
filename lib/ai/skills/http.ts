import { getSkillRuntime } from "@/lib/ai/skills/runtime";
import { recordToolQuery } from "@/lib/db/queries";
import type { AITool } from "@/lib/db/schema";

type CallHttpSkillParams = {
  toolId: string;
  input: Record<string, unknown>;
};

const HTTP_TIMEOUT_MS = 10_000; // Increased timeout
// Per paid tool invocation, we allow up to 100 HTTP requests. This is enough
// for discovery-style patterns (e.g. 1 "chains" call + a handful of
// "gas_price" lookups) while still protecting contributors from abuse.
const MAX_REQUESTS_PER_TURN = 100;

export async function callHttpSkill({ toolId, input }: CallHttpSkillParams) {
  const runtime = getSkillRuntime();
  if (!runtime.allowedTools?.has(toolId)) {
    throw new Error(
      `Tool ${toolId} is not authorized for this turn. Ensure the user selected and paid for it.`
    );
  }

  const toolContext = runtime.allowedTools.get(toolId)!;

  if (toolContext.kind !== "http") {
    throw new Error("callHttpSkill can only be used with HTTP tools.");
  }

  if (toolContext.executionCount >= MAX_REQUESTS_PER_TURN) {
    throw new Error(
      `This HTTP tool has reached its limit of ${MAX_REQUESTS_PER_TURN} calls per turn.`
    );
  }

  const endpoint = extractHttpEndpoint(toolContext.tool);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  const chatId = runtime.chatId ?? runtime.requestId;

  try {
    console.log(
      `[http-tool] Calling ${endpoint} for tool ${toolContext.tool.name}`
    );
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

    const rawPayload = await safeReadJson(response);

    toolContext.executionCount++;

    // Unwrap Context SDK standard response envelope ({ data: ..., meta: ... })
    // to provide the agent with the direct result it expects.
    let payload = rawPayload;
    if (
      rawPayload &&
      typeof rawPayload === "object" &&
      "data" in rawPayload &&
      "meta" in rawPayload
    ) {
      payload = rawPayload.data;
    }

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
    // Only increment count on success? No, failures should also count to prevent infinite failure loops.
    toolContext.executionCount++;

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
  const endpoint =
    schema && typeof schema === "object" ? schema["endpoint"] : undefined;

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
