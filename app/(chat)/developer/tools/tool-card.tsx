"use client";

import { Loader2, Pencil, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
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
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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

  const [editState, editAction, isEditing] = useActionState(editTool, initialEditState);

  const schema = tool.toolSchema as { kind?: string; tools?: unknown[] } | null;
  const isMCP = schema?.kind === "mcp";
  const skillCount = isMCP ? (schema?.tools?.length ?? 0) : 0;

  const handleRefresh = () => {
    setRefreshMessage(null);
    startRefresh(async () => {
      const result = await refreshMCPSkills(tool.id);
      setRefreshMessage(result.message ?? null);
      // Auto-clear success message after 3s
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
              ${Number(tool.totalRevenue).toFixed(2)}
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
            <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
              <form action={editAction} className="flex flex-1 flex-col">
                <SheetHeader>
                  <SheetTitle>Edit Tool</SheetTitle>
                  <SheetDescription>
                    Update your tool's name, description, category, or price. Changes
                    will be reflected in the marketplace immediately.
                  </SheetDescription>
                </SheetHeader>

                <input type="hidden" name="toolId" value={tool.id} />

                <div className="mt-6 flex-1 space-y-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      name="name"
                      defaultValue={tool.name}
                      aria-invalid={editState.fieldErrors?.name ? true : undefined}
                      className={cn(
                        editState.fieldErrors?.name &&
                          "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    {editState.fieldErrors?.name && (
                      <p className="text-destructive text-sm">
                        {editState.fieldErrors.name}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      name="description"
                      defaultValue={tool.description}
                      rows={6}
                      aria-invalid={editState.fieldErrors?.description ? true : undefined}
                      className={cn(
                        editState.fieldErrors?.description &&
                          "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    {editState.fieldErrors?.description && (
                      <p className="text-destructive text-sm">
                        {editState.fieldErrors.description}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      This is shown in the marketplace and used for semantic search.
                      Updating it will regenerate the search embedding.
                    </p>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-category">Category</Label>
                    <Select name="category" defaultValue={tool.category ?? ""}>
                      <SelectTrigger className="h-10">
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
                  <div className="space-y-2">
                    <Label htmlFor="edit-price">Price per query (USDC)</Label>
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
                        editState.fieldErrors?.pricePerQuery &&
                          "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    {editState.fieldErrors?.pricePerQuery && (
                      <p className="text-destructive text-sm">
                        {editState.fieldErrors.pricePerQuery}
                      </p>
                    )}
                  </div>
                </div>

                {/* Error message */}
                {editState.status === "error" && editState.message && (
                  <p className="mt-4 text-destructive text-sm">{editState.message}</p>
                )}

                <SheetFooter className="mt-8 pt-6 border-t">
                  <Button type="submit" disabled={isEditing} className="w-full sm:w-auto">
                    {isEditing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </SheetFooter>
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

          {/* Toggle Active/Inactive */}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5"
            disabled={isToggling}
            onClick={handleToggle}
            type="button"
          >
            {tool.isActive ? (
              <>
                <ToggleRight className="h-4 w-4" />
                Deactivate
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4" />
                Activate
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

