import { memo } from "react";
import type { AITool } from "@/lib/db/schema";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Zap } from "lucide-react";

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

  const isNative = (tool.toolSchema as any)?.kind === "skill";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="justify-between"
        isActive={isActive}
        onClick={() => onToggle(tool.id)}
        type="button"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="truncate">{tool.name}</span>
          {isNative && (
            <Zap className="h-3 w-3 text-amber-500 fill-amber-500" aria-label="Native Skill" />
          )}
        </div>
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
