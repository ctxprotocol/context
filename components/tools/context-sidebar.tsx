"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { ZapIcon } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, useMemo, useState } from "react";
import { useReadContract } from "wagmi";
// No router needed here; navigation handled elsewhere if needed
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { SPENDING_CAP_OPTIONS, useAutoPay } from "@/hooks/use-auto-pay";
import { useSessionTools } from "@/hooks/use-session-tools";
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { cn, formatPrice } from "@/lib/utils";
import { CrossIcon, LoaderIcon } from "../icons";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { AutoPayApprovalDialog } from "./auto-pay-approval-dialog";
import { ContextSidebarItem } from "./context-sidebar-item";

type ContextSidebarProps = {
  isOpen: boolean;
  className?: string;
  onClose?: () => void;
  isDebugMode: boolean;
  onToggleDebugMode: () => void;
};

export function ContextSidebar({
  isOpen,
  className,
  onClose,
  isDebugMode,
  onToggleDebugMode,
}: ContextSidebarProps) {
  const { setOpenMobile } = useSidebar();
  const { tools, loading, activeToolIds, activeTools, totalCost, toggleTool } =
    useSessionTools();
  const [searchQuery, setSearchQuery] = useState("");
  const { activeWallet } = useWalletIdentity();
  const { client: smartWalletClient } = useSmartWallets();

  // Auto Pay and Auto Mode from global context
  const {
    isAutoPay,
    spendingCap,
    spentAmount,
    isAutoMode,
    isFullAgenticMode,
    setIsAutoPay,
    setSpendingCap,
    setIsAutoMode,
    resetSpentAmount,
  } = useAutoPay();

  // State for showing the approval dialog
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [pendingCapChange, setPendingCapChange] = useState<number | null>(null);
  // Track if approval was triggered from Auto Mode toggle
  const [pendingAutoMode, setPendingAutoMode] = useState(false);

  // Get addresses for allowance check
  const walletAddress = activeWallet?.address;
  const smartWalletAddress = smartWalletClient?.account?.address;
  const allowanceCheckAddress = (smartWalletAddress || walletAddress) as
    | `0x${string}`
    | undefined;
  const routerAddress = process.env
    .NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}`;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  // Check current on-chain allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract(
    {
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: allowanceCheckAddress
        ? [allowanceCheckAddress, routerAddress]
        : undefined,
      query: {
        enabled: Boolean(
          allowanceCheckAddress && routerAddress && usdcAddress && isAutoPay
        ),
      },
    }
  );

  // Convert allowance to dollars (USDC has 6 decimals)
  const currentAllowanceUSD = currentAllowance
    ? Number(currentAllowance) / 1_000_000
    : 0;

  // When Auto Pay toggle is clicked
  const handleAutoPayToggle = () => {
    if (isAutoPay) {
      // Turning OFF - just disable
      setIsAutoPay(false);
    } else {
      // Turning ON - show approval dialog
      setShowApprovalDialog(true);
    }
  };

  // Called when approval is successful
  const handleApprovalSuccess = () => {
    setIsAutoPay(true);
    resetSpentAmount();
    setShowApprovalDialog(false);
    setPendingCapChange(null);
    // Refetch allowance to get updated value
    refetchAllowance();

    // If approval was triggered from Auto Mode toggle, also enable Auto Mode
    if (pendingAutoMode) {
      setIsAutoMode(true);
      setPendingAutoMode(false);
    }
  };

  // Called when approval is cancelled
  const handleApprovalCancel = () => {
    setShowApprovalDialog(false);
    setPendingCapChange(null);
    setPendingAutoMode(false);
  };

  // Handle spending cap button click
  const handleSpendingCapClick = (newCap: number) => {
    if (newCap <= currentAllowanceUSD) {
      // Already have enough allowance, just update the UI
      setSpendingCap(newCap);
    } else {
      // Need more allowance - show approval dialog
      setPendingCapChange(newCap);
      setShowApprovalDialog(true);
    }
  };

  // Auto Mode toggle - if Auto Pay is off, show approval dialog
  const handleAutoModeToggle = () => {
    if (isAutoMode) {
      // Turning OFF
      setIsAutoMode(false);
    } else if (isAutoPay) {
      // Auto Pay is ON, just toggle Auto Mode
      setIsAutoMode(true);
    } else {
      // Auto Pay is OFF, need to enable it first
      // Mark that we want to enable Auto Mode after approval succeeds
      setPendingAutoMode(true);
      setShowApprovalDialog(true);
    }
  };
  const categories = useMemo(
    () => Array.from(new Set(tools.map((tool) => tool.category || "Other"))),
    [tools]
  );
  const filteredTools = useMemo(
    () =>
      tools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.category?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [tools, searchQuery]
  );
  const toolsByCategory = useMemo(
    () =>
      categories.reduce(
        (acc, category) => {
          acc[category] = filteredTools.filter(
            (tool) => (tool.category || "Other") === category
          );
          return acc;
        },
        {} as Record<string, typeof tools>
      ),
    [categories, filteredTools]
  );

  return (
    <div
      className={cn(
        "relative hidden transition-[width] duration-200 ease-linear md:block",
        isOpen ? "w-[var(--sidebar-width)]" : "w-0",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 right-0 w-[var(--sidebar-width)] transition-transform duration-200 ease-linear",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <Sidebar
          className="h-full group-data-[side=right]:border-l-0"
          collapsible="none"
          side="right"
        >
          <SidebarHeader>
            <SidebarMenu>
              <div className="flex flex-col gap-2">
                <div className="flex flex-row items-center justify-between px-2">
                  <Link
                    className="flex flex-row items-center gap-3"
                    href="/"
                    onClick={() => {
                      setOpenMobile(false);
                    }}
                  >
                    <span className="cursor-pointer rounded-md px-2 font-semibold text-lg hover:bg-muted">
                      Tools
                    </span>
                  </Link>
                  <div className="flex flex-row gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="h-8 p-1 md:h-fit md:p-2"
                          onClick={onClose}
                          type="button"
                          variant="ghost"
                        >
                          <CrossIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent align="end" className="hidden md:block">
                        Close
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <SidebarInput
                  className="h-8 focus-visible:ring-ring"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search tools..."
                  value={searchQuery}
                />
              </div>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            {loading ? (
              <SidebarGroup>
                <SidebarGroupLabel>Tools</SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="flex flex-col">
                    {[44, 32, 28, 64, 52].map((item) => {
                      const skeletonStyles = {
                        "--skeleton-width": `${item}%`,
                      } as CSSProperties;
                      return (
                        <div
                          className="flex h-8 items-center gap-2 rounded-md px-2"
                          key={item}
                        >
                          <div
                            className="h-4 max-w-[var(--skeleton-width)] flex-1 rounded-md bg-sidebar-accent-foreground/10"
                            style={skeletonStyles}
                          />
                        </div>
                      );
                    })}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : filteredTools.length === 0 ? (
              <SidebarGroup>
                <SidebarGroupContent>
                  <div
                    className={cn(
                      "flex flex-row items-center justify-center gap-2 px-2 text-sm",
                      "w-full",
                      "text-sidebar-foreground/60"
                    )}
                  >
                    {searchQuery
                      ? "No tools found."
                      : "No tools available yet."}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : (
              categories.map((category) => {
                const categoryTools = toolsByCategory[category];
                if (categoryTools.length === 0) {
                  return null;
                }
                return (
                  <SidebarGroup key={category}>
                    <SidebarGroupLabel>{category}</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {categoryTools.map((tool) => (
                          <ContextSidebarItem
                            isActive={activeToolIds.includes(tool.id)}
                            key={tool.id}
                            onToggle={toggleTool}
                            tool={tool}
                          />
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                );
              })
            )}
          </SidebarContent>
          <SidebarFooter className="border-t">
            <div className="flex flex-col gap-1.5 px-2 py-2 text-sidebar-foreground/70 text-xs">
              {/* Full Agentic Mode Indicator */}
              {isFullAgenticMode && (
                <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-amber-600 dark:text-amber-400">
                  <ZapIcon className="size-3.5" />
                  <span className="font-medium">Full Agentic Mode</span>
                </div>
              )}

              {/* Auto Pay Toggle */}
              <div className="flex items-center justify-between py-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help font-medium">Auto Pay</span>
                  </TooltipTrigger>
                  <TooltipContent align="start" className="max-w-[220px]">
                    Pre-authorize payments up to a spending cap. No signing
                    required for each query.
                  </TooltipContent>
                </Tooltip>
                <button
                  aria-checked={isAutoPay}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
                    isAutoPay ? "bg-emerald-500" : "bg-input"
                  )}
                  onClick={handleAutoPayToggle}
                  role="switch"
                  type="button"
                >
                  <span
                    className={cn(
                      "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                      isAutoPay ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* Spending Cap & Budget Display (when Auto Pay is enabled) */}
              {isAutoPay && (
                <div className="flex flex-col gap-1.5 rounded-md bg-muted/50 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-sidebar-foreground/60">
                      Spending Cap
                    </span>
                    <div className="flex gap-1">
                      {SPENDING_CAP_OPTIONS.map((option) => {
                        const needsApproval =
                          option.value > currentAllowanceUSD;
                        const isSelected = spendingCap === option.value;
                        return (
                          <Tooltip key={option.value}>
                            <TooltipTrigger asChild>
                              <button
                                className={cn(
                                  "rounded px-1.5 py-0.5 font-medium text-[10px] transition-colors",
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : needsApproval
                                      ? "bg-background/50 text-sidebar-foreground/40 hover:bg-muted"
                                      : "bg-background hover:bg-muted"
                                )}
                                onClick={() =>
                                  handleSpendingCapClick(option.value)
                                }
                                type="button"
                              >
                                {option.label}
                              </button>
                            </TooltipTrigger>
                            {needsApproval && !isSelected && (
                              <TooltipContent className="text-xs">
                                Requires additional approval
                              </TooltipContent>
                            )}
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-sidebar-foreground/60">
                      Budget
                    </span>
                    <span className="font-mono text-[10px]">
                      ${formatPrice(spentAmount)} / ${formatPrice(spendingCap)}
                    </span>
                  </div>
                  {/* Budget Progress Bar */}
                  <div className="h-1 w-full overflow-hidden rounded-full bg-background">
                    <div
                      className={cn(
                        "h-full transition-all duration-200",
                        spentAmount / spendingCap > 0.9
                          ? "bg-destructive"
                          : spentAmount / spendingCap > 0.7
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      )}
                      style={{
                        width: `${Math.min((spentAmount / spendingCap) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Auto Mode Toggle */}
              <div className="flex items-center justify-between py-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn("cursor-help", !isAutoPay && "opacity-50")}
                    >
                      Auto Mode
                    </span>
                  </TooltipTrigger>
                  <TooltipContent align="start" className="max-w-[220px]">
                    {isAutoPay
                      ? "Let AI discover and use tools automatically, including paid tools"
                      : "Enable Auto Pay first to use Auto Mode with paid tools"}
                  </TooltipContent>
                </Tooltip>
                <button
                  aria-checked={isAutoMode}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
                    isAutoMode ? "bg-emerald-500" : "bg-input"
                  )}
                  onClick={handleAutoModeToggle}
                  role="switch"
                  type="button"
                >
                  <span
                    className={cn(
                      "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                      isAutoMode ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
              {isAutoMode && (
                <div className="text-[10px] text-sidebar-foreground/50 leading-tight">
                  AI will discover and use tools automatically within your
                  budget
                </div>
              )}

              {/* Developer Mode Toggle */}
              <div className="flex items-center justify-between py-1">
                <span>Developer Mode</span>
                <button
                  aria-checked={isDebugMode}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
                    isDebugMode ? "bg-primary" : "bg-input"
                  )}
                  onClick={onToggleDebugMode}
                  role="switch"
                  type="button"
                >
                  <span
                    className={cn(
                      "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                      isDebugMode ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* Tool Count & Cost Summary */}
              <div className="border-sidebar-border border-t pt-1.5">
                <div>
                  {activeTools.length}{" "}
                  {activeTools.length === 1 ? "tool" : "tools"} active
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-sidebar-foreground/50">
                    <span className="animate-spin">
                      <LoaderIcon />
                    </span>
                    <span>Calculating...</span>
                  </div>
                ) : (
                  <div className="text-sidebar-foreground/50">
                    ${formatPrice(totalCost)}/query
                  </div>
                )}
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
      </div>

      {/* Auto Pay Approval Dialog */}
      <AutoPayApprovalDialog
        initialCap={pendingCapChange ?? undefined}
        onApprovalCancel={handleApprovalCancel}
        onApprovalSuccess={handleApprovalSuccess}
        onOpenChange={setShowApprovalDialog}
        open={showApprovalDialog}
      />
    </div>
  );
}
