"use client";

import { memo } from "react";
import { BoxIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { ToolListItem } from "@/hooks/use-session-tools";
import { ChevronDownIcon } from "../icons";

type ToolPickerProps = {
  selectedTool: ToolListItem | null;
  isReadonly: boolean;
  onToggleContextSidebar?: () => void;
};

function PureToolPicker({
  selectedTool,
  isReadonly,
  onToggleContextSidebar,
}: ToolPickerProps) {
  return (
    <Button
      className="h-8 px-2"
      disabled={isReadonly}
      onClick={onToggleContextSidebar}
      type="button"
      variant="ghost"
    >
      <BoxIcon size={16} />
      <span className="hidden font-medium text-xs sm:block">
        {selectedTool ? selectedTool.name : "Tools"}
      </span>
      <ChevronDownIcon size={16} />
    </Button>
  );
}

export const ToolPicker = memo(PureToolPicker, (prevProps, nextProps) => {
  return (
    prevProps.selectedTool?.id === nextProps.selectedTool?.id &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
