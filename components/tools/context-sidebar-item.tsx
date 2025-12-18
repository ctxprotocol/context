"use client";

import { Activity, Info, Shield, TrendingUp } from "lucide-react";
import { memo, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { ToolListItem } from "@/hooks/use-session-tools";
import { useReadContextRouterGetStake } from "@/lib/generated";
import { cn, formatPrice, uuidToUint256 } from "@/lib/utils";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

// Trust thresholds for "Proven" status (matching developer tools page)
const PROVEN_QUERY_THRESHOLD = 100;
const PROVEN_SUCCESS_RATE_THRESHOLD = 95;
const PROVEN_UPTIME_THRESHOLD = 98;

function isToolProven(
  totalQueries: number,
  successRate: string | null | undefined,
  uptimePercent: string | null | undefined
): boolean {
  const success = Number.parseFloat(successRate ?? "0");
  const uptime = Number.parseFloat(uptimePercent ?? "0");

  return (
    totalQueries >= PROVEN_QUERY_THRESHOLD &&
    success >= PROVEN_SUCCESS_RATE_THRESHOLD &&
    uptime >= PROVEN_UPTIME_THRESHOLD
  );
}

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
  const [isHoverCardOpen, setIsHoverCardOpen] = useState(false);

  // Trust metrics
  const successRate = Number.parseFloat(tool.successRate ?? "100");
  const totalQueries = tool.totalQueries ?? 0;
  const isProven = isToolProven(
    totalQueries,
    tool.successRate,
    tool.uptimePercent
  );

  // Read stake directly from contract (source of truth) - only when hover card is open
  const toolIdBigInt = uuidToUint256(tool.id);
  const routerAddress = process.env
    .NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}`;
  const { data: onChainStake } = useReadContextRouterGetStake({
    args: [toolIdBigInt],
    query: {
      enabled: Boolean(routerAddress) && isHoverCardOpen,
    },
  });

  // Use on-chain stake if available, otherwise fall back to database value
  const stakedFromDb = Number.parseFloat(tool.totalStaked ?? "0");
  const stakedFromChain = onChainStake
    ? Number(onChainStake) / 1_000_000
    : null; // USDC has 6 decimals
  const totalStaked = stakedFromChain ?? stakedFromDb;

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
        <HoverCard
          closeDelay={100}
          onOpenChange={setIsHoverCardOpen}
          open={isHoverCardOpen}
          openDelay={200}
        >
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
            className="w-[420px] p-4 shadow-lg"
            side="right"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-sm">{tool.name}</h4>
                {isProven && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 text-xs dark:bg-emerald-500/15 dark:text-emerald-400">
                    <TrendingUp className="size-3" />
                    Proven
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words text-muted-foreground text-sm leading-relaxed">
                {tool.description || "No description provided."}
              </div>

              {/* Trust Metrics */}
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {/* Success Rate */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs",
                    successRate >= 95
                      ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : successRate >= 80
                        ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-500"
                        : "bg-destructive/10 text-destructive"
                  )}
                >
                  <Activity className="size-3" />
                  {successRate.toFixed(0)}% success
                </span>

                {/* Total Queries */}
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
                  {totalQueries.toLocaleString()} queries
                </span>

                {/* Staking (if any) - now reads from chain */}
                {totalStaked > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 font-medium text-blue-600 text-xs dark:bg-blue-500/15 dark:text-blue-400">
                    <Shield className="size-3" />${totalStaked.toFixed(0)}{" "}
                    staked
                  </span>
                )}
              </div>

              {/* Price */}
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
