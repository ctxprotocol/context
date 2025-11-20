import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import type { AITool } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";

export type AllowedToolContext = {
  tool: AITool;
  transactionHash: string;
  kind: "skill" | "http";
  hasExecuted?: boolean;
};

export type SkillRuntime = {
  session: Session;
  dataStream?: UIMessageStreamWriter<ChatMessage>;
  requestId?: string;
  chatId?: string;
  allowedTools?: Map<string, AllowedToolContext>;
};

let currentRuntime: SkillRuntime | null = null;

export function setSkillRuntime(runtime: SkillRuntime | null) {
  currentRuntime = runtime;
}

export function getSkillRuntime(): SkillRuntime {
  if (!currentRuntime) {
    throw new Error(
      "Skill runtime is not configured. setSkillRuntime(...) must be called before executing skills."
    );
  }
  return currentRuntime;
}
