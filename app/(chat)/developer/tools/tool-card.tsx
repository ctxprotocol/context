"use client";

import { Activity, Pencil, RefreshCw, Shield, TrendingUp } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { CrossIcon, LoaderIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { calculateRequiredStake } from "@/lib/constants";
import { cn, formatPrice } from "@/lib/utils";
import {
  type EditToolState,
  editTool,
  refreshMCPSkills,
  toggleToolStatus,
} from "./actions";

// Trust thresholds for "Proven" status
const PROVEN_QUERY_THRESHOLD = 100;
const PROVEN_SUCCESS_RATE_THRESHOLD = 95;
const PROVEN_UPTIME_THRESHOLD = 98;

type Tool = {
  id: string;
  name: string;
  description: string;
  category: string | null;
  pricePerQuery: string;
  totalQueries: number;
  totalRevenue: string;
  isActive: boolean;
  isVerified: boolean;
  toolSchema: unknown;
  // Trust metrics
  successRate?: string | null;
  uptimePercent?: string | null;
  totalStaked?: string | null;
};

/**
 * Determine if a tool qualifies for "Proven" status based on trust metrics
 */
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

const initialEditState: EditToolState = { status: "idle" };

const DESCRIPTION_MAX_LENGTH = 5000;

export function ToolCard({ tool }: { tool: Tool }) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [isToggling, startToggle] = useTransition();
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [closeTooltipOpen, setCloseTooltipOpen] = useState(false);
  const [descriptionLength, setDescriptionLength] = useState(
    tool.description.length
  );

  const [editState, editAction, isEditing] = useActionState(
    editTool,
    initialEditState
  );

  const schema = tool.toolSchema as {
    kind?: string;
    endpoint?: string;
    tools?: { name: string; outputSchema?: unknown }[];
  } | null;
  const isMCP = schema?.kind === "mcp";
  const skillCount = isMCP ? (schema?.tools?.length ?? 0) : 0;
  const currentEndpoint = isMCP ? (schema?.endpoint ?? "") : "";

  // Check for missing outputSchema on any skill (Context Protocol recommendation)
  const skillsWithoutOutputSchema =
    isMCP && schema?.tools
      ? schema.tools.filter((skill) => !skill.outputSchema)
      : [];
  const hasMissingSchema = skillsWithoutOutputSchema.length > 0;

  // Trust metrics
  const successRate = Number.parseFloat(tool.successRate ?? "100");
  const uptimePercent = Number.parseFloat(tool.uptimePercent ?? "100");
  const totalStaked = Number.parseFloat(tool.totalStaked ?? "0");
  const priceValue = Number.parseFloat(tool.pricePerQuery) || 0;
  const isProven = isToolProven(
    tool.totalQueries,
    tool.successRate,
    tool.uptimePercent
  );

  // Staking requirements - ALL tools require staking (minimum $1 or 100x price)
  const requiredStake = calculateRequiredStake(priceValue);
  const hasRequiredStake = totalStaked >= requiredStake;

  const handleRefresh = () => {
    setRefreshMessage(null);
    startRefresh(async () => {
      const result = await refreshMCPSkills(tool.id);
      setRefreshMessage(result.message ?? null);
      if (result.status === "success") {
        setTimeout(() => setRefreshMessage(null), 3000);
      }
    });
  };

  const handleToggle = () => {
    // Prevent activation if stake requirement not met (ALL tools require stake)
    if (!tool.isActive && !hasRequiredStake) {
      return; // Don't allow activation without stake
    }
    startToggle(async () => {
      await toggleToolStatus(tool.id, !tool.isActive);
    });
  };

  // Close sheet on successful edit
  useEffect(() => {
    if (editState.status === "success" && isSheetOpen) {
      setIsSheetOpen(false);
    }
  }, [editState.status, isSheetOpen]);

  // Reset tooltip state when sheet closes
  useEffect(() => {
    if (!isSheetOpen) {
      setCloseTooltipOpen(false);
    }
  }, [isSheetOpen]);

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{tool.name}</h3>
            {isMCP && (
              <Badge className="text-xs" variant="outline">
                {skillCount} {skillCount === 1 ? "skill" : "skills"}
              </Badge>
            )}
          </div>
          <Badge variant={tool.isActive ? "default" : "secondary"}>
            {tool.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Description */}
        {tool.description && (
          <p className="line-clamp-2 text-muted-foreground text-sm">
            {tool.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">
              ${tool.pricePerQuery} per query
            </span>
            <span className="text-muted-foreground text-xs">
              {tool.totalQueries.toLocaleString()} queries
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-medium">
              ${formatPrice(tool.totalRevenue)}
            </span>
            <span className="text-muted-foreground text-xs">Total Revenue</span>
          </div>
        </div>

        {/* Trust Metrics (Crypto-Native) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Proven Badge - data-driven replacement for Verified */}
          {isProven && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                  variant="outline"
                >
                  <TrendingUp className="size-3" />
                  Proven
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                100+ queries, {successRate.toFixed(0)}% success,{" "}
                {uptimePercent.toFixed(0)}% uptime
              </TooltipContent>
            </Tooltip>
          )}

          {/* Success Rate */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className={cn(
                  "gap-1",
                  successRate >= 95
                    ? "bg-emerald-500/10 text-emerald-600"
                    : successRate >= 80
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-destructive/10 text-destructive"
                )}
                variant="outline"
              >
                <Activity className="size-3" />
                {successRate.toFixed(0)}%
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Success Rate</TooltipContent>
          </Tooltip>

          {/* Staking Status - ALL tools require stake */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className={cn(
                  "gap-1",
                  hasRequiredStake
                    ? "bg-blue-500/10 text-blue-600"
                    : "bg-amber-500/10 text-amber-600"
                )}
                variant="outline"
              >
                <Shield className="size-3" />${totalStaked.toFixed(0)} staked
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {hasRequiredStake
                ? `Staked $${totalStaked.toFixed(2)} (required: $${requiredStake.toFixed(2)})`
                : `Need $${requiredStake.toFixed(2)} stake (have $${totalStaked.toFixed(2)})`}
            </TooltipContent>
          </Tooltip>

          {/* Legacy Verified badge (identity verified, not performance) */}
          {tool.isVerified && !isProven && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="w-fit" variant="outline">
                  ID Verified
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Identity verified (GitHub/Twitter linked)
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Staking Warning - ALL tools require stake */}
        {!hasRequiredStake && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
            <Shield className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            <p className="text-amber-600/90 text-xs leading-relaxed">
              This tool requires <strong>${requiredStake.toFixed(2)}</strong>{" "}
              stake to activate. Deposit stake to make your tool visible in the
              marketplace.
            </p>
          </div>
        )}

        {/* Missing outputSchema Warning */}
        {hasMissingSchema && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
            <Shield className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            <div className="text-amber-600/90 text-xs leading-relaxed">
              <p>
                {skillsWithoutOutputSchema.length === 1 ? (
                  <>
                    Skill <strong>{skillsWithoutOutputSchema[0].name}</strong>{" "}
                    is missing{" "}
                    <code className="rounded bg-amber-600/20 px-1">
                      outputSchema
                    </code>
                    .
                  </>
                ) : (
                  <>
                    {skillsWithoutOutputSchema.length} skills are missing{" "}
                    <code className="rounded bg-amber-600/20 px-1">
                      outputSchema
                    </code>
                    .
                  </>
                )}
              </p>
              <p className="mt-1">
                Without it, the AI agent cannot write accurate code to parse
                your responses, and disputes cannot be auto-resolved.{" "}
                <a
                  className="underline"
                  href="https://github.com/ctxprotocol/context#-the-data-broker-standard"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Learn more
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Refresh Message */}
        {refreshMessage && (
          <p
            className={cn(
              "text-sm",
              refreshMessage.includes("Refreshed")
                ? "text-emerald-600"
                : "text-destructive"
            )}
          >
            {refreshMessage}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 border-t pt-4">
          {/* Edit Sheet */}
          <Sheet onOpenChange={setIsSheetOpen} open={isSheetOpen}>
            <SheetTrigger asChild>
              <Button className="gap-1.5" size="sm" variant="outline">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </SheetTrigger>
            <SheetContent
              className="flex w-full flex-col overflow-y-auto border-l-0 bg-sidebar p-0 text-sidebar-foreground sm:max-w-md"
              hideCloseButton
              side="right"
            >
              <form action={editAction} className="flex flex-1 flex-col">
                {/* Header */}
                <div className="flex items-start justify-between border-sidebar-border border-b px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <h2 className="font-semibold text-lg text-sidebar-foreground">
                      Edit Tool
                    </h2>
                    <p className="text-sidebar-foreground/60 text-xs">
                      Update your tool's details. Changes are reflected
                      immediately.
                    </p>
                  </div>
                  <Tooltip open={closeTooltipOpen}>
                    <TooltipTrigger
                      asChild
                      onPointerEnter={() => setCloseTooltipOpen(true)}
                      onPointerLeave={() => setCloseTooltipOpen(false)}
                    >
                      <SheetClose asChild>
                        <Button
                          className="h-8 p-1 md:h-fit md:p-2"
                          type="button"
                          variant="ghost"
                        >
                          <CrossIcon />
                        </Button>
                      </SheetClose>
                    </TooltipTrigger>
                    <TooltipContent align="end" className="hidden md:block">
                      Close
                    </TooltipContent>
                  </Tooltip>
                </div>

                <input name="toolId" type="hidden" value={tool.id} />

                {/* Form Fields */}
                <div className="flex-1 space-y-4 px-4 py-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label
                      className="font-medium text-sidebar-foreground/60 text-xs"
                      htmlFor="edit-name"
                    >
                      Name
                    </Label>
                    <Input
                      aria-invalid={
                        editState.fieldErrors?.name ? true : undefined
                      }
                      className={cn(
                        "h-9 border-sidebar-border bg-sidebar-accent text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-ring",
                        editState.fieldErrors?.name && "border-destructive"
                      )}
                      defaultValue={tool.name}
                      id="edit-name"
                      name="name"
                    />
                    {editState.fieldErrors?.name && (
                      <p className="text-destructive text-xs">
                        {editState.fieldErrors.name}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label
                      className="font-medium text-sidebar-foreground/60 text-xs"
                      htmlFor="edit-description"
                    >
                      Description
                    </Label>
                    <Textarea
                      aria-invalid={
                        editState.fieldErrors?.description ? true : undefined
                      }
                      className={cn(
                        "resize-none border-sidebar-border bg-sidebar-accent text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-ring",
                        editState.fieldErrors?.description &&
                          "border-destructive"
                      )}
                      defaultValue={tool.description}
                      id="edit-description"
                      maxLength={DESCRIPTION_MAX_LENGTH}
                      name="description"
                      onChange={(e) => setDescriptionLength(e.target.value.length)}
                      rows={5}
                    />
                    {editState.fieldErrors?.description && (
                      <p className="text-destructive text-xs">
                        {editState.fieldErrors.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-sidebar-foreground/50 leading-tight">
                        Shown in the marketplace and used for semantic search.
                        Updating regenerates the search embedding.
                      </p>
                      <span
                        className={cn(
                          "shrink-0 text-[10px] tabular-nums",
                          descriptionLength > DESCRIPTION_MAX_LENGTH * 0.9
                            ? "text-amber-600"
                            : "text-sidebar-foreground/50"
                        )}
                      >
                        {descriptionLength.toLocaleString()}/{DESCRIPTION_MAX_LENGTH.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <Label
                      className="font-medium text-sidebar-foreground/60 text-xs"
                      htmlFor="edit-category"
                    >
                      Category
                    </Label>
                    <Select defaultValue={tool.category ?? ""} name="category">
                      <SelectTrigger className="h-9 border-sidebar-border bg-sidebar-accent text-sidebar-foreground focus:ring-ring">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Network">
                          Network (Gas, RPC, Nodes)
                        </SelectItem>
                        <SelectItem value="Actions">
                          Actions (Swaps, Lending, Execution)
                        </SelectItem>
                        <SelectItem value="Market Data">
                          Market Data (Crypto, Stocks, Forex)
                        </SelectItem>
                        <SelectItem value="Real World">
                          Real World (Weather, Sports, News)
                        </SelectItem>
                        <SelectItem value="Social">
                          Social (Identity, Governance)
                        </SelectItem>
                        <SelectItem value="Utility">
                          Utility (Search, Compute)
                        </SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price */}
                  <div className="space-y-1.5">
                    <Label
                      className="font-medium text-sidebar-foreground/60 text-xs"
                      htmlFor="edit-price"
                    >
                      Price per query (USDC)
                    </Label>
                    <Input
                      aria-invalid={
                        editState.fieldErrors?.pricePerQuery ? true : undefined
                      }
                      className={cn(
                        "h-9 border-sidebar-border bg-sidebar-accent font-mono text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-ring",
                        editState.fieldErrors?.pricePerQuery &&
                          "border-destructive"
                      )}
                      defaultValue={tool.pricePerQuery}
                      id="edit-price"
                      max="100"
                      min="0"
                      name="pricePerQuery"
                      step="0.0001"
                      type="number"
                    />
                    {editState.fieldErrors?.pricePerQuery && (
                      <p className="text-destructive text-xs">
                        {editState.fieldErrors.pricePerQuery}
                      </p>
                    )}
                  </div>

                  {/* Endpoint (MCP tools only) */}
                  {isMCP && (
                    <div className="space-y-1.5">
                      <Label
                        className="font-medium text-sidebar-foreground/60 text-xs"
                        htmlFor="edit-endpoint"
                      >
                        MCP Endpoint
                      </Label>
                      <Input
                        aria-invalid={
                          editState.fieldErrors?.endpoint ? true : undefined
                        }
                        className={cn(
                          "h-9 border-sidebar-border bg-sidebar-accent font-mono text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-ring",
                          editState.fieldErrors?.endpoint &&
                            "border-destructive"
                        )}
                        defaultValue={currentEndpoint}
                        id="edit-endpoint"
                        name="endpoint"
                        placeholder="https://your-mcp-server.com/mcp"
                        type="url"
                      />
                      {editState.fieldErrors?.endpoint && (
                        <p className="text-destructive text-xs">
                          {editState.fieldErrors.endpoint}
                        </p>
                      )}
                      <p className="text-[10px] text-sidebar-foreground/50 leading-tight">
                        Changing the endpoint will automatically validate the
                        connection and refresh skills.
                      </p>
                    </div>
                  )}

                  {/* Error message */}
                  {editState.status === "error" && editState.message && (
                    <div className="rounded-md bg-destructive/10 px-3 py-2">
                      <p className="text-destructive text-xs">
                        {editState.message}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-sidebar-border border-t px-4 py-3">
                  <Button
                    className="w-full"
                    disabled={isEditing}
                    size="sm"
                    type="submit"
                  >
                    {isEditing ? (
                      <>
                        <span className="mr-2 animate-spin">
                          <LoaderIcon size={14} />
                        </span>
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>

          {/* Refresh Skills (MCP only) */}
          {isMCP && (
            <Button
              className="gap-1.5"
              disabled={isRefreshing}
              onClick={handleRefresh}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
              />
              {isRefreshing ? "Refreshing..." : "Refresh Skills"}
            </Button>
          )}

          {/* Toggle Active/Inactive - Sidebar-style switch */}
          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-muted-foreground text-xs">
                  {tool.isActive ? "Active" : "Inactive"}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {tool.isActive
                  ? "Tool is visible in the marketplace"
                  : hasRequiredStake
                    ? "Tool is hidden from the marketplace"
                    : `Deposit $${requiredStake.toFixed(2)} stake to activate this tool`}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-checked={tool.isActive}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    tool.isActive ? "bg-emerald-500" : "bg-input"
                  )}
                  disabled={isToggling || (!tool.isActive && !hasRequiredStake)}
                  onClick={handleToggle}
                  role="switch"
                  type="button"
                >
                  <span
                    className={cn(
                      "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                      tool.isActive ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </TooltipTrigger>
              {!tool.isActive && !hasRequiredStake && (
                <TooltipContent>
                  Deposit $${requiredStake.toFixed(2)} stake to activate this
                  tool
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>
      </div>
    </Card>
  );
}
