import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import type { AITool } from "@/lib/db/schema";

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
>;

const PAGE_SIZE = 30;

export function useSessionTools() {
  const [activeToolIds, setActiveToolIds] = useLocalStorage<string[]>(
    "context-active-tools",
    []
  );
  const [tools, setTools] = useState<ToolListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | null>(null);
  const offsetRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch initial page of tools
  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    fetch(`/api/tools?limit=${PAGE_SIZE}&offset=0&count=true`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        setTools(data.tools || []);
        setTotal(data.total ?? null);
        setHasMore(data.hasMore ?? false);
        offsetRef.current = data.tools?.length ?? 0;
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Failed to fetch tools:", error);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, []);

  // Load more tools (for infinite scroll / pagination)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/tools?limit=${PAGE_SIZE}&offset=${offsetRef.current}&count=true`
      );
      const data = await res.json();

      setTools((prev) => [...prev, ...(data.tools || [])]);
      setHasMore(data.hasMore ?? false);
      offsetRef.current += data.tools?.length ?? 0;
    } catch (error) {
      console.error("Failed to load more tools:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

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

  const clearAllTools = useCallback(() => {
    setActiveToolIds([]);
  }, [setActiveToolIds]);

  const activeTools = tools.filter((tool) => activeToolIds.includes(tool.id));

  const totalCost = activeTools.reduce(
    (sum, tool) => sum + Number(tool.pricePerQuery),
    0
  );

  return {
    tools,
    loading,
    loadingMore,
    hasMore,
    total,
    activeToolIds,
    activeTools,
    totalCost,
    toggleTool,
    clearAllTools,
    loadMore,
  };
}
