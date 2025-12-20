import { useCallback, useMemo, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { useLocalStorage } from "usehooks-ts";
import type { AITool } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";

// Subset of AITool fields returned by the API for listing and payments
export type ToolListItem = Pick<
  AITool,
  | "id"
  | "name"
  | "description"
  | "category"
  | "pricePerQuery"
  | "iconUrl"
  | "isVerified"
  | "totalQueries"
  | "averageRating"
  | "toolSchema"
  | "developerWallet" // Needed for payment execution
  // Trust metrics for user decision-making
  | "successRate"
  | "uptimePercent"
  | "totalStaked"
>;

const PAGE_SIZE = 30;

const LOG_PREFIX = "[useSessionTools]";

// SWR key function for paginated tools
// Returns null to stop fetching when we've reached the end
type ToolsPage = {
  tools: ToolListItem[];
  hasMore: boolean;
  total?: number;
};

function getToolsPaginationKey(
  pageIndex: number,
  previousPageData: ToolsPage | null
): string | null {
  // Stop if previous page indicated no more data
  if (previousPageData && !previousPageData.hasMore) {
    return null;
  }

  const offset = pageIndex * PAGE_SIZE;
  return `/api/tools?limit=${PAGE_SIZE}&offset=${offset}&count=true`;
}

export function useSessionTools() {
  const [activeToolIds, setActiveToolIds] = useLocalStorage<string[]>(
    "context-active-tools",
    []
  );

  // Track component instance for debugging
  const instanceIdRef = useRef(Math.random().toString(36).slice(2, 8));

  // Extra tools found via search that aren't in the main paginated list
  // This ensures tools toggled from search results are available for payment
  const [extraTools, setExtraTools] = useState<ToolListItem[]>([]);

  // Use SWR for caching - tools won't refetch on every remount
  const {
    data: paginatedToolPages,
    size,
    setSize,
    isLoading,
    isValidating,
  } = useSWRInfinite<ToolsPage>(getToolsPaginationKey, fetcher, {
    revalidateOnFocus: false, // Don't refetch when window regains focus
    revalidateOnReconnect: false, // Don't refetch on reconnect
    revalidateFirstPage: false, // Don't refetch first page when subsequent pages load
  });

  // Derive state from SWR data
  const tools = useMemo(() => {
    if (!paginatedToolPages) {
      return [];
    }
    return paginatedToolPages.flatMap((page) => page.tools);
  }, [paginatedToolPages]);

  const total = paginatedToolPages?.[0]?.total ?? null;

  const hasMore = paginatedToolPages
    ? (paginatedToolPages.at(-1)?.hasMore ?? false)
    : true;

  // isInitialized = we have data OR we've finished loading with no data
  const isInitialized = !isLoading;

  // loadingMore = fetching additional pages (not the first page)
  const loadingMore = isValidating && size > 1;

  // Debug: Log state on every render
  console.log(LOG_PREFIX, `[${instanceIdRef.current}] render:`, {
    loading: isLoading,
    isInitialized,
    toolsCount: tools.length,
    pages: paginatedToolPages?.length ?? 0,
  });

  // Load more tools (for infinite scroll / pagination)
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) {
      return;
    }
    // SWR handles the actual fetching - just increment the page size
    setSize(size + 1);
  }, [loadingMore, hasMore, setSize, size]);

  const toggleTool = useCallback(
    (toolId: string) => {
      setActiveToolIds((current) => {
        if (current.includes(toolId)) {
          return current.filter((id) => id !== toolId);
        }
        return [...current, toolId];
      });
    },
    [setActiveToolIds]
  );

  // Add a tool from search results to ensure it's available for payment
  // Called when toggling a tool that might not be in the main paginated list
  const addToolFromSearch = useCallback((tool: ToolListItem) => {
    setExtraTools((prev) => {
      // Don't add if already exists
      if (prev.some((t) => t.id === tool.id)) {
        return prev;
      }
      return [...prev, tool];
    });
  }, []);

  const clearAllTools = useCallback(() => {
    setActiveToolIds([]);
  }, [setActiveToolIds]);

  // Merge paginated tools with extra tools from search
  // Use a Map to dedupe by ID (paginated tools take precedence)
  const allTools = useMemo(() => {
    const toolMap = new Map<string, ToolListItem>();
    // Add extra tools first (lower priority)
    for (const tool of extraTools) {
      toolMap.set(tool.id, tool);
    }
    // Add paginated tools (higher priority, overwrites extras)
    for (const tool of tools) {
      toolMap.set(tool.id, tool);
    }
    return Array.from(toolMap.values());
  }, [tools, extraTools]);

  // Active tools from the merged list
  const activeTools = allTools.filter((tool) =>
    activeToolIds.includes(tool.id)
  );

  const totalCost = activeTools.reduce(
    (sum, tool) => sum + Number(tool.pricePerQuery),
    0
  );

  return {
    tools,
    loading: isLoading,
    isInitialized,
    loadingMore,
    hasMore,
    total,
    activeToolIds,
    activeTools,
    totalCost,
    toggleTool,
    addToolFromSearch,
    clearAllTools,
    loadMore,
  };
}
