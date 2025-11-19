"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * ToolContext component
 * Displays tool execution results in a collapsible, design-system-compliant format
 * 
 * Follows design-system.json:
 * - Compact controls (h-8)
 * - Muted colors for secondary content
 * - Rounded-md borders
 * - Subtle hover states
 * - Proper spacing (gap-2, p-3)
 */
export function ToolContext({
  toolName,
  data,
}: {
  toolName: string;
  data: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border bg-muted/30">
      {/* Header - collapsible trigger */}
      <button
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        {isExpanded ? (
          <ChevronDownIcon className="size-4 shrink-0" />
        ) : (
          <ChevronRightIcon className="size-4 shrink-0" />
        )}
        <span className="font-medium text-muted-foreground">
          Tool: {toolName}
        </span>
        <span className="ml-auto text-muted-foreground text-xs">
          {isExpanded ? "Hide" : "Show"} context
        </span>
      </button>

      {/* Content - collapsible */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/10 p-3">
          <pre className="overflow-x-auto rounded-md bg-background p-3 font-mono text-xs">
            <code className="text-foreground">{data}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Parse tool context from message text
 * Extracts tool name and data from <tool-context> tags
 */
export function parseToolContext(text: string): {
  userText: string;
  toolContext: { toolName: string; data: string } | null;
} {
  const toolContextRegex = /<tool-context tool="([^"]+)">\n([\s\S]*?)\n<\/tool-context>/;
  const match = text.match(toolContextRegex);

  if (!match) {
    return { userText: text, toolContext: null };
  }

  const [fullMatch, toolName, data] = match;
  const userText = text.replace(fullMatch, "").trim();

  return {
    userText,
    toolContext: { toolName, data },
  };
}

