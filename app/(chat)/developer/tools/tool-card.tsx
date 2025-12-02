"use client";

import { Loader2, Pencil, RefreshCw } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { CrossIcon } from "@/components/icons";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatPrice } from "@/lib/utils";
import {
  editTool,
  refreshMCPSkills,
  toggleToolStatus,
  type EditToolState,
} from "./actions";

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
};

const initialEditState: EditToolState = { status: "idle" };

export function ToolCard({ tool }: { tool: Tool }) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [isToggling, startToggle] = useTransition();
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [closeTooltipOpen, setCloseTooltipOpen] = useState(false);

  const [editState, editAction, isEditing] = useActionState(editTool, initialEditState);

  const schema = tool.toolSchema as { kind?: string; tools?: unknown[] } | null;
  const isMCP = schema?.kind === "mcp";
  const skillCount = isMCP ? (schema?.tools?.length ?? 0) : 0;

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
              <Badge variant="outline" className="text-xs">
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
              {tool.totalQueries} queries
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-medium">
              ${formatPrice(tool.totalRevenue)}
            </span>
            <span className="text-muted-foreground text-xs">Total Revenue</span>
          </div>
        </div>

        {/* Verified Badge */}
        {tool.isVerified && (
          <Badge className="w-fit" variant="outline">
            ✓ Verified
          </Badge>
        )}

        {/* Refresh Message */}
        {refreshMessage && (
          <p
            className={cn(
              "text-sm",
              refreshMessage.includes("Refreshed") ? "text-emerald-600" : "text-destructive"
            )}
          >
            {refreshMessage}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 border-t pt-4">
          {/* Edit Sheet */}
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </SheetTrigger>
            <SheetContent 
              side="right" 
              className="flex w-full flex-col overflow-y-auto border-l-0 bg-sidebar p-0 text-sidebar-foreground sm:max-w-md"
              hideCloseButton
            >
              <form action={editAction} className="flex flex-1 flex-col">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-sidebar-border px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <h2 className="font-semibold text-lg text-sidebar-foreground">
                      Edit Tool
                    </h2>
                    <p className="text-sidebar-foreground/60 text-xs">
                      Update your tool's details. Changes are reflected immediately.
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

                <input type="hidden" name="toolId" value={tool.id} />

                {/* Form Fields */}
                <div className="flex-1 space-y-4 px-4 py-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label 
                      htmlFor="edit-name" 
                      className="text-sidebar-foreground/60 text-xs font-medium"
                    >
                      Name
                    </Label>
                    <Input
                      id="edit-name"
                      name="name"
                      defaultValue={tool.name}
                      aria-invalid={editState.fieldErrors?.name ? true : undefined}
                      className={cn(
                        "h-9 border-sidebar-border bg-sidebar-accent text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-ring",
                        editState.fieldErrors?.name && "border-destructive"
                      )}
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
                      htmlFor="edit-description"
                      className="text-sidebar-foreground/60 text-xs font-medium"
                    >
                      Description
                    </Label>
                    <Textarea
                      id="edit-description"
                      name="description"
                      defaultValue={tool.description}
                      rows={5}
                      aria-invalid={editState.fieldErrors?.description ? true : undefined}
                      className={cn(
                        "border-sidebar-border bg-sidebar-accent text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-ring resize-none",
                        editState.fieldErrors?.description && "border-destructive"
                      )}
                    />
                    {editState.fieldErrors?.description && (
                      <p className="text-destructive text-xs">
                        {editState.fieldErrors.description}
                      </p>
                    )}
                    <p className="text-sidebar-foreground/50 text-[10px] leading-tight">
                      Shown in the marketplace and used for semantic search. 
                      Updating regenerates the search embedding.
                    </p>
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <Label 
                      htmlFor="edit-category"
                      className="text-sidebar-foreground/60 text-xs font-medium"
                    >
                      Category
                    </Label>
                    <Select name="category" defaultValue={tool.category ?? ""}>
                      <SelectTrigger className="h-9 border-sidebar-border bg-sidebar-accent text-sidebar-foreground focus:ring-ring">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Network">Network (Gas, RPC, Nodes)</SelectItem>
                        <SelectItem value="Actions">Actions (Swaps, Lending)</SelectItem>
                        <SelectItem value="Market Data">Market Data</SelectItem>
                        <SelectItem value="Real World">Real World</SelectItem>
                        <SelectItem value="Social">Social</SelectItem>
                        <SelectItem value="Utility">Utility</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price */}
                  <div className="space-y-1.5">
                    <Label 
                      htmlFor="edit-price"
                      className="text-sidebar-foreground/60 text-xs font-medium"
                    >
                      Price per query (USDC)
                    </Label>
                    <Input
                      id="edit-price"
                      name="pricePerQuery"
                      type="number"
                      step="0.0001"
                      min="0"
                      max="100"
                      defaultValue={tool.pricePerQuery}
                      aria-invalid={editState.fieldErrors?.pricePerQuery ? true : undefined}
                      className={cn(
                        "h-9 border-sidebar-border bg-sidebar-accent text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-ring font-mono",
                        editState.fieldErrors?.pricePerQuery && "border-destructive"
                      )}
                    />
                    {editState.fieldErrors?.pricePerQuery && (
                      <p className="text-destructive text-xs">
                        {editState.fieldErrors.pricePerQuery}
                      </p>
                    )}
                  </div>

                  {/* Error message */}
                  {editState.status === "error" && editState.message && (
                    <div className="rounded-md bg-destructive/10 px-3 py-2">
                      <p className="text-destructive text-xs">{editState.message}</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-sidebar-border px-4 py-3">
                  <Button 
                    type="submit" 
                    disabled={isEditing} 
                    className="w-full"
                    size="sm"
                  >
                    {isEditing ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
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
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isRefreshing}
              onClick={handleRefresh}
              type="button"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
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
                  : "Tool is hidden from the marketplace"}
              </TooltipContent>
            </Tooltip>
            <button
              aria-checked={tool.isActive}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:cursor-not-allowed disabled:opacity-50",
                tool.isActive ? "bg-emerald-500" : "bg-input"
              )}
              disabled={isToggling}
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
          </div>
        </div>
      </div>
    </Card>
  );
}
