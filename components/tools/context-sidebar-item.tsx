import { Info, Zap } from "lucide-react";
import { memo } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { AITool } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
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

  const isNative = (tool.toolSchema as any)?.kind === "skill";

  return (
    <SidebarMenuItem>
      <div className="flex w-full items-center gap-1">
      <SidebarMenuButton
          className="group/item h-auto flex-1 justify-between py-2.5"
        isActive={isActive}
        onClick={() => onToggle(tool.id)}
        type="button"
      >
          <div className="flex min-w-0 flex-col items-start gap-1 text-left">
            <div className="flex w-full items-center gap-2">
              <span className="truncate font-medium text-sm">{tool.name}</span>
              {isNative && (
                <Zap
                  aria-label="Native Skill"
                  className="h-3 w-3 shrink-0 fill-amber-500 text-amber-500"
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
        <HoverCard closeDelay={100} openDelay={200}>
          <HoverCardTrigger asChild>
            <button
              aria-label="Tool details"
              className="flex h-full shrink-0 items-center justify-center px-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
            >
              <Info className="h-4 w-4 opacity-50 hover:opacity-100" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            align="start"
            className="w-96 p-4 shadow-lg"
            side="right"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{tool.name}</h4>
                {isNative && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-[10px] text-amber-500">
                    <Zap className="h-3 w-3 fill-amber-500" />
                    Native
                  </span>
                )}
              </div>
              <div className="max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words text-muted-foreground text-sm leading-relaxed">
                {tool.description || "No description provided."}
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-muted-foreground text-xs">Price</span>
                <span className="font-medium text-sm">
                  ${formattedPrice}/query
                </span>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>
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
