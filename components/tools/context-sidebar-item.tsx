import { memo } from "react";
import type { AITool } from "@/lib/db/schema";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

const PureContextSidebarItem = ({
  tool,
  isActive,
  onToggle,
}: {
  tool: AITool;
  isActive: boolean;
  onToggle: (toolId: string) => void;
}) => {
  const formattedPrice = tool.pricePerQuery
    ? Number(tool.pricePerQuery).toFixed(2)
    : "0.00";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="justify-between"
        isActive={isActive}
        onClick={() => onToggle(tool.id)}
        type="button"
      >
        <span className="truncate">{tool.name}</span>
        <span className="text-sidebar-foreground/50 text-xs">
          ${formattedPrice}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

export const ContextSidebarItem = memo(
  PureContextSidebarItem,
  (prevProps, nextProps) => {
    return (
      prevProps.tool.id === nextProps.tool.id &&
      prevProps.isActive === nextProps.isActive
    );
  }
);
