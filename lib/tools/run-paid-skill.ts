import type { Session } from "next-auth";
import {
  executeSkillCode,
  REGISTERED_SKILL_MODULES,
  type AllowedModule,
} from "@/lib/ai/code-executor";
import { auth } from "@/app/(auth)/auth";
import { getAIToolById, getChatById, recordToolQuery } from "@/lib/db/queries";
import type { AITool } from "@/lib/db/schema";
import { verifyPayment } from "./payment-verifier";

type RunPaidSkillInput = {
  toolId: string;
  transactionHash: string;
  code: string;
  chatId?: string;
  session: Session;
};

type RunPaidSkillResult = {
  tool: AITool;
  data: unknown;
  logs: string[];
  durationMs: number;
};

const registeredModuleSet = new Set<string>(REGISTERED_SKILL_MODULES);

function resolveAllowedModules(tool: AITool): AllowedModule[] {
  const schema = tool.toolSchema;
  if (!schema || typeof schema !== "object") {
    throw new Error("Tool schema missing skill definition.");
  }

  const skillField = (schema as Record<string, unknown>).skill;
  if (!skillField) {
    throw new Error("Tool schema does not declare a skill.");
  }

  const skillsArray = Array.isArray(skillField) ? skillField : [skillField];
  const modules = skillsArray
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const moduleId = (entry as Record<string, unknown>).module;
      if (typeof moduleId !== "string") {
        return null;
      }
      return registeredModuleSet.has(moduleId)
        ? (moduleId as AllowedModule)
        : null;
    })
    .filter((moduleId): moduleId is AllowedModule => Boolean(moduleId));

  if (modules.length === 0) {
    throw new Error("Tool references an unsupported skill module.");
  }

  return modules;
}

export async function runPaidSkill({
  toolId,
  transactionHash,
  code,
  chatId,
  session,
}: RunPaidSkillInput): Promise<RunPaidSkillResult> {
  const tool = await getAIToolById({ id: toolId });

  if (!tool) {
    throw new Error("Tool not found");
  }

  if (!tool.isActive) {
    throw new Error("Tool is not active");
  }

  const paymentVerification = await verifyPayment(
    transactionHash as `0x${string}`,
    toolId,
    tool.developerWallet
  );

  if (!paymentVerification.isValid) {
    throw new Error(
      paymentVerification.error || "Payment verification failed."
    );
  }

  let safeChatId: string | undefined;
  if (chatId) {
    const chat = await getChatById({ id: chatId });
    if (chat) {
      safeChatId = chatId;
    }
  }

  const allowedModules = resolveAllowedModules(tool);

  const executionResult = await executeSkillCode({
    code,
    allowedModules,
    runtime: {
      session,
      requestId: chatId || toolId,
    },
  });

  await recordToolQuery({
    toolId,
    userId: session.user.id,
    chatId: safeChatId,
    amountPaid: tool.pricePerQuery,
    transactionHash,
    queryOutput: executionResult.ok
      ? (executionResult.data as Record<string, unknown>)
      : undefined,
    status: executionResult.ok ? "completed" : "failed",
  });

  if (!executionResult.ok) {
    throw new Error(executionResult.error);
  }

  return {
    tool,
    data: executionResult.data,
    logs: executionResult.logs,
    durationMs: executionResult.durationMs,
  };
}

/**
 * Utility for routes that rely on the user's session implicitly.
 */
export async function runPaidSkillWithAuth(params: Omit<RunPaidSkillInput, "session">) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return runPaidSkill({ ...params, session });
}




