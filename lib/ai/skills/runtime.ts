import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import type { AITool } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";

export type AllowedToolContext = {
  tool: AITool;
  transactionHash: string;
  kind: "skill" | "mcp";
  executionCount: number;
};

/**
 * Tool usage tracking for Auto Mode
 * Records tools used during execution for batch payment at end
 */
export type AutoModeToolUsage = {
  tool: AITool;
  callCount: number;
};

/**
 * Record of a single tool call during execution
 * Used for reflection/retry when execution produces suspicious results
 */
export type ToolCallRecord = {
  toolId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  timestamp: number;
};

export type SkillRuntime = {
  session: Session;
  dataStream?: UIMessageStreamWriter<ChatMessage>;
  requestId?: string;
  chatId?: string;
  allowedTools?: Map<string, AllowedToolContext>;
  
  // Auto Mode: AI can discover and use tools dynamically
  isAutoMode?: boolean;
  
  // Auto Mode Discovery Phase: Only search marketplace, don't execute paid tools
  // When true, callMcpSkill will reject paid tool calls
  isDiscoveryPhase?: boolean;
  
  // Track tools USED during Auto Mode execution (tool ID -> usage info)
  // Populated as callMcpSkill is called, used for batch payment at end
  autoModeToolsUsed?: Map<string, AutoModeToolUsage>;
  
  // Agentic Reflection: Capture raw tool outputs for diagnosis
  // When execution produces suspicious results, we can show these to the AI
  toolCallHistory?: ToolCallRecord[];
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
