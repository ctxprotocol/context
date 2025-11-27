"use client";

import { ChevronDownIcon } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  type ExecutionLogEntry,
  getPaymentStatusMessage,
  type PaymentStage,
} from "@/hooks/use-payment-status";
import { cn } from "@/lib/utils";

type ThinkingAccordionProps = {
  stage: PaymentStage;
  toolName: string | null;
  streamingCode: string | null;
  debugResult: string | null;
  executionLogs: ExecutionLogEntry[];
  isDebugMode: boolean;
};

// Extract code block from planning response
// Handles both complete blocks (with closing ```) and partial blocks (still streaming)
const COMPLETE_CODE_BLOCK_REGEX = /```(?:ts|typescript)?\s*([\s\S]*?)```/i;
const LANG_IDENTIFIER_REGEX = /^(ts|typescript)\s*/i;
const WHITESPACE_REGEX = /^\s*/;

function extractCodeFromPlanningText(
  text: string | null,
  isStreaming: boolean
): string | null {
  if (!text) {
    return null;
  }

  // First try to match a complete code block (has closing ```)
  const completeMatch = COMPLETE_CODE_BLOCK_REGEX.exec(text);
  if (completeMatch) {
    return completeMatch[1].trim();
  }

  // If streaming and no complete block, try to match a partial block (no closing ```)
  // Look for opening ``` and capture everything after it
  if (isStreaming) {
    const openingIndex = text.indexOf("```");
    if (openingIndex !== -1) {
      // Find where the code starts (after ```ts or ```typescript or just ```)
      let codeStart = openingIndex + 3;
      const afterBackticks = text.slice(codeStart);

      // Skip language identifier if present
      const langMatch = LANG_IDENTIFIER_REGEX.exec(afterBackticks);
      if (langMatch) {
        codeStart += langMatch[0].length;
      } else {
        // Skip any leading whitespace/newline after ```
        const whitespaceMatch = WHITESPACE_REGEX.exec(afterBackticks);
        if (whitespaceMatch) {
          codeStart += whitespaceMatch[0].length;
        }
      }

      const partialCode = text.slice(codeStart);
      if (partialCode.length > 0) {
        return partialCode;
      }
    }
  }

  return null;
}

// Check if we're in an active phase (show chevron for expandable content)
function isActivePhase(stage: PaymentStage): boolean {
  return (
    stage === "setting-cap" ||
    stage === "confirming-payment" ||
    stage === "planning" ||
    stage === "executing" ||
    stage === "thinking" ||
    stage === "querying-tool"
  );
}

// Faded code preview with bottom gradient fade
function FadedCodePreview({
  code,
  isStreaming,
}: {
  code: string;
  isStreaming: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const codeLength = code.length;

  // Auto-scroll to bottom as code streams
  // biome-ignore lint/correctness/useExhaustiveDependencies: codeLength triggers scroll when code changes
  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [codeLength, isStreaming]);

  return (
    <div className="relative mt-2 max-h-32 overflow-hidden rounded-md">
      {/* Code content */}
      <div
        className="overflow-y-auto font-mono text-muted-foreground/70 text-xs leading-relaxed"
        ref={containerRef}
        style={{ maxHeight: "8rem" }}
      >
        <pre className="whitespace-pre-wrap break-words p-3">
          {code}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-muted-foreground/50" />
          )}
        </pre>
      </div>

      {/* Fade gradient overlay - fades from transparent at top to background at bottom */}
      <div className="fade-to-background pointer-events-none absolute inset-0" />
    </div>
  );
}

// Faded result preview
function FadedResultPreview({ result }: { result: string }) {
  // Try to format JSON for better readability
  let displayResult = result;
  try {
    const parsed = JSON.parse(result);
    displayResult = JSON.stringify(parsed, null, 2);
  } catch {
    // Keep original if not valid JSON
  }

  return (
    <div className="relative mt-2 max-h-24 overflow-hidden rounded-md">
      <div className="overflow-hidden font-mono text-muted-foreground/60 text-xs leading-relaxed">
        <pre className="whitespace-pre-wrap break-words p-3">
          {displayResult.slice(0, 500)}
          {displayResult.length > 500 && "..."}
        </pre>
      </div>

      {/* Fade gradient overlay */}
      <div className="fade-to-background pointer-events-none absolute inset-0" />
    </div>
  );
}

// Execution logs preview - shows real-time tool queries and results as they arrive
// Mirrors the planning stage behavior: "executing..." disappears when content appears
function ExecutionLogsPreview({
  logs,
  isExecuting,
}: {
  logs: ExecutionLogEntry[];
  isExecuting: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const logsCount = logs.length;

  // Auto-scroll to bottom as new logs arrive
  // biome-ignore lint/correctness/useExhaustiveDependencies: logsCount triggers scroll when logs change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logsCount]);

  // Show "executing..." only when no logs yet (mirrors "generating code..." behavior)
  if (logs.length === 0) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
        <div className="size-1.5 animate-pulse rounded-full bg-amber-500/70" />
        <span className="font-mono">executing...</span>
      </div>
    );
  }

  // Once logs arrive, show them without dots (matches code preview style)
  return (
    <div className="relative mt-2 max-h-32 overflow-hidden rounded-md">
      <div
        className="overflow-y-auto font-mono text-muted-foreground/70 text-xs leading-relaxed"
        ref={containerRef}
        style={{ maxHeight: "8rem" }}
      >
        <pre className="whitespace-pre-wrap break-words p-3">
          {logs.map((log, index) => (
            <span
              className={cn(log.type === "error" && "text-destructive")}
              key={`${log.timestamp}-${index}`}
            >
              {log.message}
              {index < logs.length - 1 && "\n"}
            </span>
          ))}
          {/* Pulsing cursor while still executing (matches code streaming cursor) */}
          {isExecuting && (
            <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-muted-foreground/50" />
          )}
        </pre>
      </div>

      {/* Fade gradient overlay */}
      <div className="fade-to-background pointer-events-none absolute inset-0" />
    </div>
  );
}

function PureThinkingAccordion({
  stage,
  toolName,
  streamingCode,
  debugResult,
  executionLogs,
  isDebugMode,
}: ThinkingAccordionProps) {
  // Auto-expand during active stages, or if debug mode is on
  const isActive = isActivePhase(stage);
  const [isExpanded, setIsExpanded] = useState(isDebugMode || isActive);
  const [userToggled, setUserToggled] = useState(false);

  // Determine if we're actively streaming code
  const isStreamingCode = stage === "planning";

  // Extract just the code block from the full planning text
  // Pass isStreaming to handle partial code blocks during streaming
  const extractedCode = useMemo(
    () => extractCodeFromPlanningText(streamingCode, isStreamingCode),
    [streamingCode, isStreamingCode]
  );

  // Auto-expand when entering active stages (unless user manually collapsed)
  // Auto-collapse when returning to idle (unless debug mode is on)
  useEffect(() => {
    if (userToggled) {
      return; // Respect user's manual toggle
    }

    if (isActive) {
      setIsExpanded(true);
    } else if (!isDebugMode && stage === "idle") {
      setIsExpanded(false);
    }
  }, [isActive, isDebugMode, stage, userToggled]);

  // Reset userToggled when stage changes to allow auto-expand on new queries
  // biome-ignore lint/correctness/useExhaustiveDependencies: stage is used as a trigger
  useEffect(() => {
    setUserToggled(false);
  }, [stage]);

  const statusMessage = getPaymentStatusMessage(stage, toolName);
  const hasCode = Boolean(extractedCode);
  const hasResult = Boolean(debugResult);
  const hasLogs = executionLogs.length > 0;
  const showExpandOption = hasCode || hasResult || hasLogs || isActive;

  // Don't render anything if we're idle with no content
  if (stage === "idle" && !hasCode && !hasResult) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Main status row with animated gradient text */}
      <button
        className={cn(
          "group flex w-full items-center gap-2 text-left transition-all duration-200",
          showExpandOption && "cursor-pointer"
        )}
        disabled={!showExpandOption}
        onClick={() => {
          if (showExpandOption) {
            setUserToggled(true);
            setIsExpanded(!isExpanded);
          }
        }}
        type="button"
      >
        {/* Animated gradient status text */}
        <span className="payment-status-gradient animate-status-gradient bg-size-200 text-gradient text-sm">
          {statusMessage}
        </span>

        {/* Chevron indicator */}
        {showExpandOption && (
          <ChevronDownIcon
            className={cn(
              "size-3.5 text-muted-foreground/50 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Expandable preview section */}
      {showExpandOption && (
        <div
          className={cn(
            "grid transition-all duration-300 ease-out",
            isExpanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            {/* Payment stages - show status indicators */}
            {stage === "setting-cap" && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-blue-500/70" />
                <span className="font-mono">
                  approving spending allowance...
                </span>
              </div>
            )}

            {stage === "confirming-payment" && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-green-500/70" />
                <span className="font-mono">
                  processing blockchain transaction...
                </span>
              </div>
            )}

            {/* Code preview with fade - only show during planning stage */}
            {stage === "planning" && extractedCode && (
              <FadedCodePreview code={extractedCode} isStreaming={true} />
            )}

            {/* Show generating indicator if planning but no code yet */}
            {stage === "planning" && !extractedCode && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-muted-foreground/50" />
                <span className="font-mono">generating code...</span>
              </div>
            )}

            {/* Executing - show real-time execution logs */}
            {stage === "executing" && (
              <ExecutionLogsPreview isExecuting={true} logs={executionLogs} />
            )}

            {/* Thinking indicator */}
            {stage === "thinking" && !hasResult && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-purple-500/70" />
                <span className="font-mono">analyzing results...</span>
              </div>
            )}

            {/* Querying tool indicator */}
            {stage === "querying-tool" && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-cyan-500/70" />
                <span className="font-mono">
                  querying {toolName ?? "tool"}...
                </span>
              </div>
            )}

            {/* Result preview with fade - only show meaningful results */}
            {hasResult && stage !== "executing" && stage !== "thinking" && (
              <FadedResultPreview result={debugResult ?? ""} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const ThinkingAccordion = memo(
  PureThinkingAccordion,
  (prevProps, nextProps) => {
    if (prevProps.stage !== nextProps.stage) {
      return false;
    }
    if (prevProps.toolName !== nextProps.toolName) {
      return false;
    }
    if (prevProps.streamingCode !== nextProps.streamingCode) {
      return false;
    }
    if (prevProps.debugResult !== nextProps.debugResult) {
      return false;
    }
    if (prevProps.executionLogs.length !== nextProps.executionLogs.length) {
      return false;
    }
    if (prevProps.isDebugMode !== nextProps.isDebugMode) {
      return false;
    }
    return true;
  }
);

ThinkingAccordion.displayName = "ThinkingAccordion";
