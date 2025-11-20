import { memo } from "react";
import type { AITool } from "@/lib/db/schema";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

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
        className="group/item h-auto justify-between py-2.5"
        isActive={isActive}
        onClick={() => onToggle(tool.id)}
        type="button"
        tooltip={tool.description || tool.name}
      >
        <div className="flex min-w-0 flex-col items-start gap-1 text-left">
          <div className="flex w-full items-center gap-2">
            <span className="truncate font-medium text-sm">{tool.name}</span>
            {isNative && (
              <Zap
                aria-label="Native Skill"
                className="h-3 w-3 shrink-0 text-amber-500 fill-amber-500"
              />
            )}
          </div>
          <span className="font-normal text-muted-foreground text-xs">
            ${formattedPrice}
          </span>
        </div>
        <div
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
            isActive
              ? "bg-primary"
              : "bg-sidebar-border group-hover/item:bg-sidebar-accent-foreground/20"
          )}
        >
          <div
            className={cn(
              "absolute top-0 left-0 h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200",
              isActive ? "translate-x-4" : "translate-x-0"
            )}
          />
        </div>
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
