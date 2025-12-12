"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { ZapIcon } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
} from "@/components/ui/sidebar";
import { SPENDING_CAP_OPTIONS, useAutoPay } from "@/hooks/use-auto-pay";
import type { ToolListItem } from "@/hooks/use-session-tools";
import { useSessionTools } from "@/hooks/use-session-tools";
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { cn, formatPrice } from "@/lib/utils";
import { CrossIcon, LoaderIcon } from "../icons";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { AutoPayApprovalDialog } from "./auto-pay-approval-dialog";
import { ContextSidebarItem } from "./context-sidebar-item";

const DEBOUNCE_MS = 300;
const LOG_PREFIX = "[tool-search]";
const SIDEBAR_LOG = "[context-sidebar]";

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
  const {
    tools,
    loading,
    isInitialized,
    loadingMore,
    hasMore,
    total,
    activeToolIds,
    activeTools,
    totalCost,
    toggleTool,
    addToolFromSearch,
    loadMore,
  } = useSessionTools();
  const [searchQuery, setSearchQuery] = useState("");
  const [vectorResults, setVectorResults] = useState<ToolListItem[] | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Refs for debounce and abort
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { activeWallet } = useWalletIdentity();
  const { client: smartWalletClient } = useSmartWallets();

  // Vector search function
  const performVectorSearch = async (query: string) => {
    console.log(LOG_PREFIX, "performVectorSearch called with:", query);

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      console.log(LOG_PREFIX, "Aborting previous request");
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsSearching(true);
    setSearchError(null);

    const url = `/api/tools/search?q=${encodeURIComponent(query)}&limit=20`;
    console.log(LOG_PREFIX, "Fetching:", url);

    try {
      const startTime = performance.now();
      const response = await fetch(url, { signal });
      const duration = Math.round(performance.now() - startTime);

      console.log(
        LOG_PREFIX,
        `Response status: ${response.status} (${duration}ms)`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(LOG_PREFIX, "Response data:", {
        toolCount: data.tools?.length ?? 0,
        searchType: data.searchType,
        query: data.query,
        toolNames: data.tools?.map((t: ToolListItem) => t.name) ?? [],
      });

      setVectorResults(data.tools || []);
      setSearchError(null);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log(LOG_PREFIX, "Request aborted (expected)");
        return; // Don't update state for aborted requests
      }

      console.error(LOG_PREFIX, "Search failed:", error);
      setSearchError(error instanceof Error ? error.message : "Search failed");
      setVectorResults(null); // Fall back to client-side filtering
    } finally {
      // Only clear searching if this wasn't aborted
      if (!signal.aborted) {
        setIsSearching(false);
        console.log(LOG_PREFIX, "Search complete, isSearching=false");
      }
    }
  };

  // Handle search input change with manual debounce
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    console.log(LOG_PREFIX, "Input changed:", query);
    setSearchQuery(query);

    // Clear any pending debounce
    if (debounceTimerRef.current) {
      console.log(LOG_PREFIX, "Clearing debounce timer");
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // If empty, clear results immediately
    if (!query.trim()) {
      console.log(LOG_PREFIX, "Empty query, clearing results");
      setVectorResults(null);
      setIsSearching(false);
      setSearchError(null);

      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }

    // Start debounce timer for vector search
    console.log(LOG_PREFIX, `Starting debounce timer (${DEBOUNCE_MS}ms)`);
    setIsSearching(true); // Show loading immediately

    debounceTimerRef.current = setTimeout(() => {
      console.log(LOG_PREFIX, "Debounce timer fired");
      performVectorSearch(query);
    }, DEBOUNCE_MS);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log(LOG_PREFIX, "Component unmounting, cleanup");
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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

  // Determine which tools to display
  // If we have a search query and vector results, use those
  // Otherwise, fall back to client-side filtering
  const isSearchActive = searchQuery.trim().length > 0;

  // Client-side filtering (fallback)
  const clientFilteredTools = useMemo(
    () =>
      tools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.category?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [tools, searchQuery]
  );

  // Use vector results if available, otherwise client-side filtered
  const displayTools = isSearchActive
    ? (vectorResults ?? clientFilteredTools)
    : tools;

  // Debug: Log which render path will be taken
  const showSkeleton = loading || !isInitialized;
  const showNoTools =
    !showSkeleton && !isSearchActive && displayTools.length === 0;
  const showCategories =
    !showSkeleton && !isSearchActive && displayTools.length > 0;

  console.log(SIDEBAR_LOG, "render decision:", {
    loading,
    isInitialized,
    toolsCount: tools.length,
    displayToolsCount: displayTools.length,
    isSearchActive,
    showSkeleton,
    showNoTools,
    showCategories,
  });

  // Wrapper for toggling tools that also stores search result tools
  // This ensures tools found via search are available for payment even if
  // they're not in the first page of paginated results
  const handleToggleTool = useCallback(
    (toolId: string) => {
      // If we're in search mode, find the tool and store it
      if (isSearchActive) {
        const searchTool = displayTools.find((t) => t.id === toolId);
        if (searchTool) {
          addToolFromSearch(searchTool);
        }
      }
      toggleTool(toolId);
    },
    [isSearchActive, displayTools, addToolFromSearch, toggleTool]
  );

  const categories = useMemo(
    () => Array.from(new Set(tools.map((tool) => tool.category || "Other"))),
    [tools]
  );

  const toolsByCategory = useMemo(
    () =>
      categories.reduce(
        (acc, category) => {
          acc[category] = displayTools.filter(
            (tool) => (tool.category || "Other") === category
          );
          return acc;
        },
        {} as Record<string, typeof tools>
      ),
    [categories, displayTools]
  );

  // Log state for debugging
  useEffect(() => {
    if (isSearchActive) {
      console.log(LOG_PREFIX, "Search state:", {
        query: searchQuery,
        isSearching,
        hasVectorResults: vectorResults !== null,
        vectorResultCount: vectorResults?.length ?? 0,
        clientFilterCount: clientFilteredTools.length,
        displayToolCount: displayTools.length,
        error: searchError,
      });
    }
  }, [
    searchQuery,
    isSearching,
    vectorResults,
    clientFilteredTools.length,
    displayTools.length,
    searchError,
    isSearchActive,
  ]);

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
              <div className="flex flex-row items-center justify-between">
                <span className="cursor-pointer rounded-md px-2 font-semibold text-lg hover:bg-muted">
                  Tools
                </span>
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
              <div className="relative">
                <SidebarInput
                  className="h-8 focus-visible:ring-ring"
                  onChange={handleSearchChange}
                  placeholder="Search tools..."
                  value={searchQuery}
                />
                {isSearching && (
                  <div className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2 animate-spin text-muted-foreground">
                    <LoaderIcon size={16} />
                  </div>
                )}
              </div>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            {loading || !isInitialized ? (
              <SidebarGroup>
                <SidebarGroupLabel className="text-sidebar-foreground/50">
                  Tools
                </SidebarGroupLabel>
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
            ) : isSearchActive ? (
              // Search mode
              <SidebarGroup>
                <SidebarGroupLabel className="text-sidebar-foreground/50">
                  {isSearching
                    ? "Searching..."
                    : displayTools.length > 0
                      ? `${displayTools.length} result${displayTools.length === 1 ? "" : "s"}`
                      : "Results"}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  {isSearching ? (
                    // Loading skeletons during search
                    <div className="flex flex-col">
                      {[52, 40, 64, 48, 56].map((item) => {
                        const skeletonStyles = {
                          "--skeleton-width": `${item}%`,
                        } as CSSProperties;
                        return (
                          <div
                            className="flex h-8 animate-pulse items-center gap-2 rounded-md px-2"
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
                  ) : displayTools.length === 0 ? (
                    // No results
                    <div className="px-2 py-4 text-sidebar-foreground/60 text-sm">
                      No tools found.
                    </div>
                  ) : (
                    // Search results list
                    <SidebarMenu>
                      {displayTools.map((tool) => (
                        <ContextSidebarItem
                          isActive={activeToolIds.includes(tool.id)}
                          key={tool.id}
                          onToggle={handleToggleTool}
                          tool={tool}
                        />
                      ))}
                    </SidebarMenu>
                  )}
                </SidebarGroupContent>
              </SidebarGroup>
            ) : displayTools.length === 0 ? (
              // No tools at all
              <SidebarGroup>
                <SidebarGroupContent>
                  <div className="flex w-full flex-row items-center gap-2 px-2 text-sm text-zinc-500">
                    {/* <div className="px-2 text-sidebar-foreground/60 text-sm"> */}
                    No tools available yet.
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : (
              // Default view - grouped by category
              <>
                {categories.map((category) => {
                  const categoryTools = toolsByCategory[category];
                  if (categoryTools.length === 0) {
                    return null;
                  }
                  return (
                    <SidebarGroup key={category}>
                      <SidebarGroupLabel className="text-sidebar-foreground/50">
                        {category}
                      </SidebarGroupLabel>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {categoryTools.map((tool) => (
                            <ContextSidebarItem
                              isActive={activeToolIds.includes(tool.id)}
                              key={tool.id}
                              onToggle={handleToggleTool}
                              tool={tool}
                            />
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </SidebarGroup>
                  );
                })}
                {/* Load more button for pagination */}
                {hasMore && (
                  <div className="px-2 py-3">
                    <Button
                      className="w-full"
                      disabled={loadingMore}
                      onClick={loadMore}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {loadingMore ? (
                        <>
                          <span className="mr-2 animate-spin">
                            <LoaderIcon size={16} />
                          </span>
                          Loading...
                        </>
                      ) : (
                        `Load more${total ? ` (${tools.length}/${total})` : ""}`
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </SidebarContent>
          <SidebarFooter className="border-t">
            <div className="flex flex-col gap-1.5 px-2 py-2 text-sidebar-foreground/50 text-xs">
              {/* Full Agentic Mode Indicator */}
              {isFullAgenticMode && (
                <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-amber-600 dark:bg-amber-500/15 dark:text-amber-500">
                  <ZapIcon className="size-3.5" />
                  <span className="font-medium">Full Agentic Mode</span>
                </div>
              )}

              {/* Auto Pay Toggle */}
              <div className="flex items-center justify-between py-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help text-sidebar-foreground/70">
                      Auto Pay
                    </span>
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
                    <span className="font-mono text-[10px] text-sidebar-foreground/70">
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
                      className={cn(
                        "cursor-help text-sidebar-foreground/70",
                        !isAutoPay && "text-sidebar-foreground/40"
                      )}
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help text-sidebar-foreground/70">
                      Developer Mode
                    </span>
                  </TooltipTrigger>
                  <TooltipContent align="start" className="max-w-[220px]">
                    Show detailed tool execution logs and debug information.
                  </TooltipContent>
                </Tooltip>
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
              <div className="-mb-1.5 border-sidebar-border border-t pt-2">
                {loading ? (
                  <div className="flex h-10 flex-row items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="animate-pulse rounded-md bg-sidebar-accent text-transparent">
                        0 tools active
                      </span>
                      <span className="animate-pulse rounded-md bg-sidebar-accent text-transparent">
                        $0.00/query
                      </span>
                    </div>
                    <div className="animate-spin text-sidebar-foreground/50">
                      <LoaderIcon size={16} />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-10 flex-col justify-center">
                    <div className="text-sidebar-foreground/70">
                      {activeTools.length}{" "}
                      {activeTools.length === 1 ? "tool" : "tools"} active
                    </div>
                    <div className="text-sidebar-foreground/50">
                      ${formatPrice(totalCost)}/query
                    </div>
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
