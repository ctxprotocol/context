"use client";

import { ChevronDownIcon } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  type ExecutionLogEntry,
  getPaymentStatusMessage,
  type PaymentStage,
  type TransactionInfo,
} from "@/hooks/use-payment-status";
import { cn } from "@/lib/utils";

type ThinkingAccordionProps = {
  stage: PaymentStage;
  toolName: string | null;
  streamingCode: string | null;
  debugResult: string | null;
  executionLogs: ExecutionLogEntry[];
  // Reasoning/thinking support
  streamingReasoning: string | null;
  isReasoningComplete: boolean;
  // Transaction tracking for blockchain payments
  transactionInfo: TransactionInfo;
  isDebugMode: boolean;
};

// Extract code block from planning response
// Handles both complete blocks (with closing ```) and partial blocks (still streaming)
// Supports: ts, typescript, json (for tool selection), js, javascript
const COMPLETE_CODE_BLOCK_REGEX = /```(?:ts|typescript|json|js|javascript)?\s*([\s\S]*?)```/i;
const LANG_IDENTIFIER_REGEX = /^(ts|typescript|json|js|javascript)\s*/i;
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
// Note: "thinking" is intentionally excluded - it's a brief transitional stage
// and including it causes jarring layout shifts when transitioning to the response
function isActivePhase(stage: PaymentStage): boolean {
  return (
    stage === "setting-cap" ||
    stage === "confirming-payment" ||
    stage === "planning" ||
    stage === "discovering-tools" ||
    stage === "awaiting-tool-approval" ||
    stage === "executing" ||
    stage === "fixing" ||
    stage === "reflecting" ||
    stage === "verifying-data" ||
    stage === "completing" ||
    stage === "rediscovering-tools" ||
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

// Faded reasoning/thoughts preview - matches code/execution styling for consistency
function FadedReasoningPreview({
  reasoning,
  isStreaming,
}: {
  reasoning: string;
  isStreaming: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reasoningLength = reasoning.length;

  // Auto-scroll to bottom as reasoning streams
  // biome-ignore lint/correctness/useExhaustiveDependencies: reasoningLength triggers scroll when reasoning changes
  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [reasoningLength, isStreaming]);

  return (
    <div className="relative mt-2 max-h-32 overflow-hidden rounded-md">
      {/* Reasoning content - matches code/execution styling */}
      <div
        className="overflow-y-auto font-mono text-muted-foreground/70 text-xs leading-relaxed"
        ref={containerRef}
        style={{ maxHeight: "8rem" }}
      >
        <pre className="whitespace-pre-wrap break-words p-3">
          {reasoning}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-muted-foreground/50" />
          )}
        </pre>
      </div>

      {/* Fade gradient overlay */}
      <div className="fade-to-background pointer-events-none absolute inset-0" />
    </div>
  );
}

// Combined reasoning + code preview - one continuous stream
// Reasoning appears first, then code streams in after. All in one scrollable container.
function CombinedStreamPreview({
  reasoning,
  code,
  isStreaming,
}: {
  reasoning: string | null;
  code: string | null;
  isStreaming: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentLength = (reasoning?.length ?? 0) + (code?.length ?? 0);

  // Auto-scroll to bottom as content streams
  // biome-ignore lint/correctness/useExhaustiveDependencies: contentLength triggers scroll when content changes
  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [contentLength, isStreaming]);

  return (
    <div className="relative mt-2 max-h-32 overflow-hidden rounded-md">
      <div
        className="overflow-y-auto font-mono text-muted-foreground/70 text-xs leading-relaxed"
        ref={containerRef}
        style={{ maxHeight: "8rem" }}
      >
        <pre className="whitespace-pre-wrap break-words p-3">
          {/* Reasoning first */}
          {reasoning}
          {/* Code after reasoning (with a newline separator if both exist) */}
          {reasoning && code && "\n\n"}
          {code}
          {/* Pulsing cursor while streaming */}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-muted-foreground/50" />
          )}
        </pre>
      </div>

      {/* Fade gradient overlay */}
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

// Transaction status preview - shows blockchain tx progress
// Displays: pending → submitted (with hash) → confirmed
function TransactionStatusPreview({
  transactionInfo,
}: {
  transactionInfo: TransactionInfo;
}) {
  const { hash, status, error } = transactionInfo;

  // Format hash for display (show first and last 4 chars)
  const formatHash = (h: string) => `${h.slice(0, 6)}...${h.slice(-4)}`;

  // Base explorer URL (using BaseScan for Base network)
  const explorerUrl = hash ? `https://basescan.org/tx/${hash}` : null;

  return (
    <div className="mt-2 space-y-1.5 rounded-md p-2 text-xs">
      {/* Pending state - waiting for user/wallet */}
      {status === "pending" && !hash && (
        <div className="flex items-center gap-2 text-muted-foreground/50">
          <div className="size-1.5 animate-pulse rounded-full bg-amber-500/70" />
          <span className="font-mono">awaiting signature...</span>
        </div>
      )}

      {/* Submitted state - tx sent, show hash */}
      {status === "submitted" && hash && (
        <div className="flex items-center gap-2 text-muted-foreground/70">
          <div className="size-1.5 animate-pulse rounded-full bg-blue-500/70" />
          <span className="font-mono">tx submitted:</span>
          <a
            className="font-mono text-blue-500 hover:underline"
            href={explorerUrl ?? "#"}
            rel="noopener noreferrer"
            target="_blank"
          >
            {formatHash(hash)}
          </a>
        </div>
      )}

      {/* Confirmed state */}
      {status === "confirmed" && hash && (
        <div className="flex items-center gap-2 text-green-600/80">
          <span className="text-sm">✓</span>
          <span className="font-mono">confirmed:</span>
          <a
            className="font-mono hover:underline"
            href={explorerUrl ?? "#"}
            rel="noopener noreferrer"
            target="_blank"
          >
            {formatHash(hash)}
          </a>
        </div>
      )}

      {/* Failed state */}
      {status === "failed" && (
        <div className="flex items-center gap-2 text-destructive">
          <span className="text-sm">✗</span>
          <span className="font-mono">
            {error?.includes("rejected") || error?.includes("denied")
              ? "cancelled by user"
              : "transaction failed"}
          </span>
        </div>
      )}
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
  streamingReasoning,
  isReasoningComplete,
  transactionInfo,
  isDebugMode,
}: ThinkingAccordionProps) {
  // Auto-expand during active stages, or if debug mode is on
  const isActive = isActivePhase(stage);
  const [isExpanded, setIsExpanded] = useState(isDebugMode || isActive);
  const [userToggled, setUserToggled] = useState(false);

  // Determine if we're actively streaming code
  // Include all stages that generate/stream code for real-time partial block display
  const isStreamingCode =
    stage === "planning" ||
    stage === "discovering-tools" ||
    stage === "fixing" ||
    stage === "reflecting";
  const hasReasoning = Boolean(streamingReasoning);
  const isStreamingReasoning = hasReasoning && !isReasoningComplete;

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

  // Only reset userToggled when starting a NEW query (transitioning from idle to active)
  // This allows the accordion to stay collapsed if the user manually closed it during a flow
  const prevStageRef = useRef<PaymentStage>(stage);
  useEffect(() => {
    const prevStage = prevStageRef.current;
    prevStageRef.current = stage;
    
    // Only reset when going from idle to an active stage (new query starting)
    if (prevStage === "idle" && isActive) {
      setUserToggled(false);
    }
  }, [stage, isActive]);

  const statusMessage = getPaymentStatusMessage(stage, toolName);
  const hasCode = Boolean(extractedCode);
  const hasResult = Boolean(debugResult);
  const hasLogs = executionLogs.length > 0;
  const showExpandOption =
    hasCode || hasResult || hasLogs || hasReasoning || isActive;

  // Don't render anything if we're idle with no content
  if (stage === "idle" && !hasCode && !hasResult && !hasReasoning) {
    return null;
  }

  return (
    // overflow-anchor: none prevents this element from being used as a scroll anchor
    // This fixes the jarring "snap back" when the accordion content changes/collapses
    <div className="w-full" style={{ overflowAnchor: "none" }}>
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
              ? "grid-rows-[minmax(0,_1fr)] opacity-100"
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
              <TransactionStatusPreview transactionInfo={transactionInfo} />
            )}

            {/* Discovering tools stage - Auto Mode searching marketplace
                One continuous stream: reasoning flows into code in same container */}
            {stage === "discovering-tools" && (
              <>
                {/* Show searching indicator only when no content yet */}
                {!hasReasoning && !extractedCode && (
                  <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                    <div className="size-1.5 animate-pulse rounded-full bg-cyan-500/70" />
                    <span className="font-mono">searching marketplace...</span>
                  </div>
                )}

                {/* Combined stream: reasoning then code in one container */}
                {(hasReasoning || extractedCode) && (
                  <CombinedStreamPreview
                    reasoning={streamingReasoning}
                    code={extractedCode}
                    isStreaming={isStreamingReasoning || Boolean(extractedCode)}
                  />
                )}
              </>
            )}

            {/* Awaiting tool approval stage - tools selected, waiting for payment
                Just show indicator - discovery content was already shown in previous stage */}
            {stage === "awaiting-tool-approval" && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-green-500/70" />
                <span className="font-mono">
                  {toolName ? `found: ${toolName}` : "reviewing tools..."}
                </span>
              </div>
            )}

            {/* Planning stage - one continuous stream: reasoning flows into code */}
            {stage === "planning" && (
              <>
                {/* Show "generating code..." only when no content yet */}
                {!extractedCode && !hasReasoning && (
                  <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                    <div className="size-1.5 animate-pulse rounded-full bg-amber-500/70" />
                    <span className="font-mono">generating code...</span>
                  </div>
                )}

                {/* Combined stream: reasoning then code in one container */}
                {(hasReasoning || extractedCode) && (
                  <CombinedStreamPreview
                    reasoning={streamingReasoning}
                    code={extractedCode}
                    isStreaming={isStreamingReasoning || Boolean(extractedCode)}
                  />
                )}
              </>
            )}

            {/* Executing - show real-time execution logs */}
            {stage === "executing" && (
              <ExecutionLogsPreview isExecuting={true} logs={executionLogs} />
            )}

            {/* Fixing stage - AI is attempting to fix a runtime error
                Just show indicator - fix generation happens server-side via generateText */}
            {stage === "fixing" && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-orange-500/70" />
                <span className="font-mono">diagnosing error...</span>
              </div>
            )}

            {/* Reflecting stage - AI is reflecting on suspicious results
                Just show indicator - reflection happens server-side via generateText */}
            {stage === "reflecting" && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-purple-500/70" />
                <span className="font-mono">reflecting on data...</span>
              </div>
            )}

            {/* Verifying data stage - Checking if tool results are complete */}
            {stage === "verifying-data" && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-emerald-500/70" />
                <span className="font-mono">verifying completeness...</span>
              </div>
            )}

            {/* Completing stage - Fixing incomplete data by fetching more */}
            {stage === "completing" && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-teal-500/70" />
                <span className="font-mono">fetching missing data...</span>
              </div>
            )}

            {/* Rediscovering tools stage - Current tools can't help, searching for alternatives */}
            {stage === "rediscovering-tools" && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-amber-500/70" />
                <span className="font-mono">searching for better tools...</span>
              </div>
            )}

            {/* Note: "thinking" stage intentionally has no expandable content.
                It's a brief transitional stage - just shows the status text.
                Adding content here causes jarring layout shifts. */}

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
            {/* Hide during discovering-tools since we show the streaming selection instead */}
            {hasResult &&
              stage !== "executing" &&
              stage !== "thinking" &&
              stage !== "discovering-tools" && (
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
    if (prevProps.streamingReasoning !== nextProps.streamingReasoning) {
      return false;
    }
    if (prevProps.isReasoningComplete !== nextProps.isReasoningComplete) {
      return false;
    }
    if (
      prevProps.transactionInfo.hash !== nextProps.transactionInfo.hash ||
      prevProps.transactionInfo.status !== nextProps.transactionInfo.status
    ) {
      return false;
    }
    if (prevProps.isDebugMode !== nextProps.isDebugMode) {
      return false;
    }
    return true;
  }
);

ThinkingAccordion.displayName = "ThinkingAccordion";
