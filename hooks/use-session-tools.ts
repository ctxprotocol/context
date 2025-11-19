import { useCallback, useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import type { AITool } from "@/lib/db/schema";

export function useSessionTools() {
  const [activeToolIds, setActiveToolIds] = useLocalStorage<string[]>(
    "context-active-tools",
    []
  );
  const [tools, setTools] = useState<AITool[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch available tools
  useEffect(() => {
    setLoading(true);
    fetch("/api/tools")
      .then((res) => res.json())
      .then((data) => {
        setTools(data.tools || []);
      })
      .catch((error) => {
        console.error("Failed to fetch tools:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

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
    activeToolIds,
    activeTools,
    totalCost,
    toggleTool,
    clearAllTools,
  };
}
