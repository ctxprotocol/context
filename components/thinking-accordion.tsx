"use client";

import { ChevronDownIcon, CodeIcon, PlayIcon, SparklesIcon } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getPaymentStatusMessage,
  type PaymentStage,
} from "@/hooks/use-payment-status";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./elements/code-block";

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

// Streaming code display component - shows code as it streams in with cursor
function StreamingCodeDisplay({ 
  code, 
  isStreaming 
}: { 
  code: string; 
  isStreaming: boolean;
}) {
  const containerRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to bottom as code streams
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [code]);

  return (
    <div className="relative overflow-hidden rounded-md border bg-background">
      {/* Header bar matching CodeBlock style */}
      <div className="flex items-center justify-between border-b bg-muted px-4 py-2">
        <span className="font-medium text-muted-foreground text-xs lowercase">
          typescript
        </span>
        {isStreaming && (
          <span className="font-mono text-muted-foreground/60 text-xs">
            streaming...
          </span>
        )}
      </div>
      {/* Code content with streaming cursor */}
      <pre
        ref={containerRef}
        className="max-h-64 overflow-auto p-4 font-mono text-foreground text-sm"
      >
        <code className="whitespace-pre-wrap break-words">
          {code}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-primary" />
          )}
        </code>
      </pre>
    </div>
  );
}

// Check if we're in an active planning/execution phase
function isActivePhase(stage: PaymentStage): boolean {
  return (
    stage === "planning" ||
    stage === "executing" ||
    stage === "thinking" ||
    stage === "querying-tool"
  );
}

function PureThinkingAccordion({
  stage,
  toolName,
  streamingCode,
  debugResult,
  isDebugMode,
}: ThinkingAccordionProps) {
  // Default open state based on Developer Mode
  const [isOpen, setIsOpen] = useState(isDebugMode);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  // Extract just the code block from the full planning text
  const extractedCode = useMemo(
    () => extractCodeFromPlanningText(streamingCode),
    [streamingCode]
  );

  // Auto-scroll code container to bottom as new code streams in
  useEffect(() => {
    if (codeContainerRef.current && isOpen && extractedCode) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [extractedCode, isOpen]);

  // Update open state when debug mode changes
  useEffect(() => {
    setIsOpen(isDebugMode);
  }, [isDebugMode]);

  const statusMessage = getPaymentStatusMessage(stage, toolName);
  const hasCode = Boolean(extractedCode);
  const hasResult = Boolean(debugResult);
  const showAccordion = isActivePhase(stage) || hasCode || hasResult;

  if (!showAccordion) {
    return null;
  }

  // Get status indicator
  const getStatusIcon = () => {
    switch (stage) {
      case "planning":
        return <CodeIcon className="size-3.5 animate-pulse text-blue-500" />;
      case "executing":
        return <PlayIcon className="size-3.5 animate-pulse text-amber-500" />;
      case "thinking":
        return <SparklesIcon className="size-3.5 animate-pulse" />;
      default:
        return <SparklesIcon className="size-3.5" />;
    }
  };

  // Get summary text for collapsed state
  const getSummaryText = () => {
    if (stage === "planning" || stage === "executing" || stage === "thinking") {
      return statusMessage;
    }
    if (hasCode && hasResult) {
      return "Executed code successfully";
    }
    if (hasCode) {
      return "Generated code";
    }
    return statusMessage;
  };

  return (
    <Collapsible
      className="w-full rounded-lg border bg-card/50"
      onOpenChange={setIsOpen}
      open={isOpen}
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium text-muted-foreground text-sm">
            {getSummaryText()}
          </span>
        </div>
        <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        <div className="space-y-3 px-3 pb-3">
          {/* Streaming Code Display */}
          {(hasCode || stage === "planning") && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <CodeIcon className="size-3 text-muted-foreground" />
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  {stage === "planning" ? "Writing Code" : "Generated Code"}
                </span>
              </div>
              <div
                ref={codeContainerRef}
                className="overflow-hidden rounded-md"
              >
                {stage === "planning" ? (
                  // While streaming: show raw code with cursor animation
                  extractedCode ? (
                    <StreamingCodeDisplay
                      code={extractedCode}
                      isStreaming={true}
                    />
                  ) : (
                    <div className="rounded-md border bg-muted/50 p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <div className="size-2 animate-pulse rounded-full bg-blue-500" />
                        <span>Generating code...</span>
                      </div>
                    </div>
                  )
                ) : hasCode ? (
                  // After streaming complete: show syntax highlighted code
                  <CodeBlock
                    code={extractedCode ?? ""}
                    language="typescript"
                    showLineNumbers
                  />
                ) : null}
              </div>
            </div>
          )}

          {/* Execution Status */}
          {stage === "executing" && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/50">
              <PlayIcon className="size-3.5 animate-pulse text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-700 text-sm dark:text-amber-300">
                Executing code...
              </span>
            </div>
          )}

          {/* Execution Result */}
          {hasResult && stage !== "executing" && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <SparklesIcon className="size-3 text-muted-foreground" />
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Execution Result
                </span>
              </div>
              <div className="max-h-48 overflow-auto rounded-md">
                <CodeBlock
                  code={debugResult}
                  language="json"
                />
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
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

