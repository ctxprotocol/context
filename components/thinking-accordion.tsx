"use client";

import { ChevronDownIcon } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  getPaymentStatusMessage,
  type PaymentStage,
} from "@/hooks/use-payment-status";
import { cn } from "@/lib/utils";

type ThinkingAccordionProps = {
  stage: PaymentStage;
  toolName: string | null;
  streamingCode: string | null;
  debugResult: string | null;
  isDebugMode: boolean;
};

// Extract code block from planning response (same regex as server)
const CODE_BLOCK_REGEX = /```(?:ts|typescript)?\s*([\s\S]*?)```/i;

function extractCodeFromPlanningText(text: string | null): string | null {
  if (!text) return null;
  const match = CODE_BLOCK_REGEX.exec(text);
  return match ? match[1].trim() : null;
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
  isStreaming 
}: { 
  code: string; 
  isStreaming: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as code streams
  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [code, isStreaming]);

  return (
    <div className="relative mt-2 max-h-32 overflow-hidden rounded-md">
      {/* Code content */}
      <div
        ref={containerRef}
        className="overflow-y-auto font-mono text-muted-foreground/70 text-xs leading-relaxed"
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

function PureThinkingAccordion({
  stage,
  toolName,
  streamingCode,
  debugResult,
  isDebugMode,
}: ThinkingAccordionProps) {
  // Default: collapsed unless in debug mode
  const [isExpanded, setIsExpanded] = useState(isDebugMode);

  // Extract just the code block from the full planning text
  const extractedCode = useMemo(
    () => extractCodeFromPlanningText(streamingCode),
    [streamingCode]
  );

  // Update expanded state when debug mode changes
  useEffect(() => {
    setIsExpanded(isDebugMode);
  }, [isDebugMode]);

  const statusMessage = getPaymentStatusMessage(stage, toolName);
  const hasCode = Boolean(extractedCode);
  const hasResult = Boolean(debugResult);
  const isActive = isActivePhase(stage);
  const showExpandOption = hasCode || hasResult || isActive;

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
        onClick={() => showExpandOption && setIsExpanded(!isExpanded)}
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
            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            {/* Payment stages - show status indicators */}
            {stage === "setting-cap" && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-blue-500/70" />
                <span className="font-mono">approving spending allowance...</span>
              </div>
            )}

            {stage === "confirming-payment" && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-green-500/70" />
                <span className="font-mono">processing blockchain transaction...</span>
              </div>
            )}

            {/* Code preview with fade */}
            {(hasCode || stage === "planning") && extractedCode && (
              <FadedCodePreview
                code={extractedCode}
                isStreaming={stage === "planning"}
              />
            )}

            {/* Show generating indicator if planning but no code yet */}
            {stage === "planning" && !extractedCode && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-muted-foreground/50" />
                <span className="font-mono">generating code...</span>
              </div>
            )}

            {/* Executing indicator */}
            {stage === "executing" && (
              <div className="mt-2 flex items-center gap-2 rounded-md p-2 text-muted-foreground/50 text-xs">
                <div className="size-1.5 animate-pulse rounded-full bg-amber-500/70" />
                <span className="font-mono">executing...</span>
              </div>
            )}

            {/* Result preview with fade */}
            {hasResult && stage !== "executing" && (
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
    if (prevProps.stage !== nextProps.stage) return false;
    if (prevProps.toolName !== nextProps.toolName) return false;
    if (prevProps.streamingCode !== nextProps.streamingCode) return false;
    if (prevProps.debugResult !== nextProps.debugResult) return false;
    if (prevProps.isDebugMode !== nextProps.isDebugMode) return false;
    return true;
  }
);

ThinkingAccordion.displayName = "ThinkingAccordion";
