"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const REASON_OPTIONS: { value: DisputeReason; label: string; description: string }[] = [
  {
    value: "schema_mismatch",
    label: "Schema Mismatch",
    description: "Output type doesn't match declared schema (auto-verified)",
  },
  {
    value: "execution_error",
    label: "Execution Error",
    description: "Tool crashed, timed out, or returned an error",
  },
  {
    value: "data_fabrication",
    label: "Data Fabrication",
    description: "Tool returned obviously fake or incorrect data",
  },
  {
    value: "malicious_content",
    label: "Malicious Content",
    description: "Tool returned harmful, scam, or inappropriate content",
  },
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ReportToolModalProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportToolModal({ chatId, open, onOpenChange }: ReportToolModalProps) {
  const { data, isLoading, error } = useSWR<ToolsResponse>(
    open ? `/api/chat/${chatId}/tools` : null,
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

      // Reset and close
      setSelectedTool(null);
      setSelectedTx(null);
      setReason(null);
      setDetails("");
      onOpenChange(false);
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

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Report an Issue</AlertDialogTitle>
          <AlertDialogDescription>
            Select which tool had a problem and describe the issue. Your transaction
            hash serves as proof of payment.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <span className="animate-spin">
                <LoaderIcon size={24} />
              </span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
              Failed to load tools. Please try again.
            </div>
          )}

          {/* No Tools Used */}
          {data && data.totalQueries === 0 && (
            <div className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
              No paid tools were used in this chat.
              <br />
              Only paid tool usage can be disputed.
            </div>
          )}

          {/* Tool Selection */}
          {data && data.totalQueries > 0 && !selectedTool && (
            <div className="space-y-3">
              <Label>Select the tool with the issue</Label>
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {data.transactions.map((tx) => (
                  <div key={tx.transactionHash} className="space-y-2">
                    {tx.tools.map((tool) => (
                      <button
                        key={tool.queryId}
                        type="button"
                        onClick={() => handleToolSelect(tool, tx.transactionHash)}
                        className={cn(
                          "w-full flex items-center justify-between rounded-md border p-3",
                          "text-left text-sm transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{tool.toolName}</span>
                          <span className="text-xs text-muted-foreground">
                            ${tool.amountPaid} • {tool.status}
                          </span>
                        </div>
                        <span className="text-muted-foreground">→</span>
                      </button>
                    ))}
                    <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                      <span>tx: {tx.transactionHash.slice(0, 10)}...{tx.transactionHash.slice(-6)}</span>
                      <a
                        href={`https://basescan.org/tx/${tx.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 hover:text-foreground"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reason Selection */}
          {selectedTool && !reason && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>What went wrong?</Label>
                <button
                  type="button"
                  onClick={() => setSelectedTool(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Back
                </button>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">{selectedTool.toolName}</span>
              </div>
              <div className="space-y-2">
                {REASON_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReason(option.value)}
                    className={cn(
                      "w-full flex flex-col gap-0.5 rounded-md border p-3",
                      "text-left text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Details Input */}
          {selectedTool && reason && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Additional Details (optional)</Label>
                <button
                  type="button"
                  onClick={() => setReason(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Back
                </button>
              </div>
              <div className="space-y-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selectedTool.toolName}</span>
                  <span className="text-xs text-muted-foreground">
                    {REASON_OPTIONS.find((r) => r.value === reason)?.label}
                  </span>
                </div>
              </div>
              <Textarea
                placeholder="Describe what happened (e.g., 'Returned gas price as string instead of number')"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {reason === "schema_mismatch" ? (
                  <>
                    <strong className="text-amber-600">Auto-verified:</strong> Schema
                    mismatches are automatically validated by comparing the tool's output
                    against its declared schema.
                  </>
                ) : (
                  "Our review team will investigate your report."
                )}
              </p>
            </div>
          )}
        </div>

        <AlertDialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {selectedTool && reason && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="animate-spin">
                    <LoaderIcon size={16} />
                  </span>
                  Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

