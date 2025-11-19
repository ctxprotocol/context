import { useCallback, useState } from "react";
import type { AITool } from "@/lib/db/schema";

export function useToolSelection() {
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);

  const selectTool = useCallback((tool: AITool) => {
    setSelectedTool(tool);
  }, []);

  const clearTool = useCallback(() => {
    setSelectedTool(null);
  }, []);

  return {
    selectedTool,
    selectTool,
    clearTool,
  };
}
