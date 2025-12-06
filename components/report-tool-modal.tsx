"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { 
  AlertTriangle, 
  ArrowLeft, 
  Check, 
  ExternalLink, 
  MessageSquareWarning,
  AlertOctagon,
  ShieldAlert,
  XCircle 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { LoaderIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type DisputeReason =
  | "schema_mismatch"
  | "execution_error"
  | "malicious_content"
  | "data_fabrication";

type ToolInfo = {
  queryId: string;
  toolId: string;
  toolName: string;
  toolCategory: string | null;
  amountPaid: string;
  status: string;
  hasOutput: boolean;
};

type Transaction = {
  transactionHash: string;
  totalPaid: string;
  executedAt: string;
  tools: ToolInfo[];
};

type ToolsResponse = {
  chatId: string;
  transactions: Transaction[];
  totalQueries: number;
};

const REASON_OPTIONS: { 
  value: DisputeReason; 
  label: string; 
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: "schema_mismatch",
    label: "Schema Mismatch",
    description: "Output doesn't match declared schema (auto-verified)",
    icon: AlertOctagon,
  },
  {
    value: "execution_error",
    label: "Execution Error",
    description: "Tool crashed, timed out, or returned an error",
    icon: XCircle,
  },
  {
    value: "data_fabrication",
    label: "Data Fabrication",
    description: "Tool returned obviously fake or incorrect data",
    icon: MessageSquareWarning,
  },
  {
    value: "malicious_content",
    label: "Malicious Content",
    description: "Tool returned harmful, scam, or inappropriate content",
    icon: ShieldAlert,
  },
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ReportToolModalProps {
  chatId: string;
  messageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportToolModal({ chatId, messageId, open, onOpenChange }: ReportToolModalProps) {
  // Pass messageId to filter tools to just this message's turn
  const { data, isLoading, error } = useSWR<ToolsResponse>(
    open ? `/api/chat/${chatId}/tools?messageId=${messageId}` : null,
    fetcher
  );

  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null);
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToolSelect = (tool: ToolInfo, txHash: string) => {
    setSelectedTool(tool);
    setSelectedTx(txHash);
  };

  const handleSubmit = async () => {
    if (!selectedTool || !selectedTx || !reason) {
      toast.error("Please select a tool and reason");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/tools/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: selectedTool.toolId,
          transactionHash: selectedTx,
          reason,
          details: details.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit dispute");
      }

      if (result.dispute?.verdict === "guilty") {
        toast.success("Dispute submitted and auto-verified as valid!", {
          description: "The tool has been flagged for schema violation.",
        });
      } else if (result.dispute?.verdict === "innocent") {
        toast.info("Dispute submitted but schema validation passed", {
          description: "Our review team will investigate further.",
        });
      } else {
        toast.success("Dispute submitted successfully", {
          description: "Our review team will investigate.",
        });
      }

      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit dispute");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedTool(null);
    setSelectedTx(null);
    setReason(null);
    setDetails("");
    onOpenChange(false);
  };

  const resetSelection = () => {
    if (reason) {
      setReason(null);
    } else if (selectedTool) {
      setSelectedTool(null);
      setSelectedTx(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md sm:max-w-lg" hideClose>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {(selectedTool || reason) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2"
                onClick={resetSelection}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>Report an Issue</DialogTitle>
          </div>
          <DialogDescription>
            {!selectedTool 
              ? "Select a tool transaction to report an issue." 
              : !reason 
                ? "Select the type of issue you encountered."
                : "Provide additional details about the issue."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex w-full flex-col gap-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-1/3" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">
              <AlertTriangle className="h-8 w-8" />
              <p className="font-medium">Failed to load tools</p>
              <Button variant="outline" size="sm" onClick={() => mutate(`/api/chat/${chatId}/tools`)} className="mt-2 border-destructive/20 hover:bg-destructive/10">
                Try Again
              </Button>
            </div>
          )}

          {/* No Tools Used */}
          {data && data.totalQueries === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <MessageSquareWarning className="h-8 w-8 opacity-50" />
              <p className="font-medium text-foreground">No paid tools used</p>
              <p className="text-sm">Only paid tool usage can be disputed.</p>
            </div>
          )}

          {/* Tool Selection */}
          {data && data.totalQueries > 0 && !selectedTool && (
            <div className="space-y-4">
              <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                {data.transactions.map((tx) => (
                  <div key={tx.transactionHash} className="space-y-2">
                    {tx.tools.map((tool) => (
                      <button
                        key={tool.queryId}
                        type="button"
                        onClick={() => handleToolSelect(tool, tx.transactionHash)}
                        className={cn(
                          "group relative flex w-full flex-col gap-2 rounded-lg border bg-card p-4 text-left transition-all",
                          "hover:border-primary hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      >
                        <div className="flex w-full items-start justify-between gap-4">
                          <div className="space-y-1">
                            <span className="font-semibold">{tool.toolName}</span>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">${tool.amountPaid}</span>
                              <span>•</span>
                              <span className="capitalize">{tool.status}</span>
                            </div>
                          </div>
                          <div className="rounded-full bg-secondary p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <ArrowLeft className="h-4 w-4 rotate-180" />
                          </div>
                        </div>
                      </button>
                    ))}
                    <div className="flex items-center justify-end gap-2 px-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                      <span>TX: {tx.transactionHash.slice(0, 8)}...{tx.transactionHash.slice(-6)}</span>
                      <a
                        href={`https://basescan.org/tx/${tx.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reason Selection */}
          {selectedTool && !reason && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Reporting:</span>
                  <span className="font-medium text-sm">{selectedTool.toolName}</span>
              </div>
              </div>
              
              <div className="grid gap-3">
                {REASON_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReason(option.value)}
                    className={cn(
                        "flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left transition-all",
                        "hover:border-primary hover:bg-accent/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background",
                        "group-hover:border-primary group-hover:text-primary"
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <span className="font-medium leading-none">{option.label}</span>
                        <p className="text-xs text-muted-foreground">
                      {option.description}
                        </p>
                      </div>
                  </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Details Input */}
          {selectedTool && reason && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
               <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tool</span>
                  <span className="font-medium">{selectedTool.toolName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Issue</span>
                  <span className="font-medium">{REASON_OPTIONS.find((r) => r.value === reason)?.label}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="details">Additional Details</Label>
              <Textarea
                  id="details"
                  placeholder="Please describe what happened..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              </div>

              {reason === "schema_mismatch" && (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200">
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold">Auto-verification Enabled</p>
                    <p className="mt-1 opacity-90">
                      We will automatically validate the tool's output against its declared schema. If a mismatch is found, the dispute will be approved instantly.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!selectedTool ? (
            <Button variant="outline" onClick={handleClose}>Close</Button>
          ) : (
            <div className="flex w-full justify-between gap-2 sm:justify-end">
               <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {selectedTool && reason && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                      <span className="mr-2 animate-spin">
                    <LoaderIcon size={16} />
                  </span>
                  Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

