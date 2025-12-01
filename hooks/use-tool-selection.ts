import { useCallback, useState } from "react";
import type { ToolListItem } from "@/hooks/use-session-tools";

export function useToolSelection() {
  const [selectedTool, setSelectedTool] = useState<ToolListItem | null>(null);

  const selectTool = useCallback((tool: ToolListItem) => {
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
