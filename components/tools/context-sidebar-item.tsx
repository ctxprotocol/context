import { Info } from "lucide-react";
import { memo } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { ToolListItem } from "@/hooks/use-session-tools";
import { cn, formatPrice } from "@/lib/utils";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

const PureContextSidebarItem = ({
  tool,
  isActive,
  onToggle,
}: {
  tool: ToolListItem;
  isActive: boolean;
  onToggle: (toolId: string) => void;
  similarity?: number | null;
}) => {
  const formattedPrice = formatPrice(tool.pricePerQuery ?? 0);

  return (
    <SidebarMenuItem>
      <div className="flex w-full items-center gap-1">
        <SidebarMenuButton
          className="group/item h-auto flex-1 justify-between py-2.5 data-[active=true]:font-normal"
          isActive={isActive}
          onClick={() => onToggle(tool.id)}
          type="button"
        >
          <div className="flex min-w-0 flex-col items-start gap-1 text-left">
            <div className="flex w-full items-center gap-2">
              <span className="truncate text-sm">{tool.name}</span>
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
