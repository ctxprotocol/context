"use client";

import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  ExternalLink,
  MoreHorizontal,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SlashButton } from "@/components/admin/slash-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import type { DisputeWithTool } from "@/lib/db/queries";

interface DisputeRowProps {
  dispute: DisputeWithTool;
}

export function DisputeRow({ dispute }: DisputeRowProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleVerdict = async (verdict: "guilty" | "innocent") => {
    try {
      setIsUpdating(true);
      const res = await fetch(`/api/admin/disputes/${dispute.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict }),
      });

      if (!res.ok) {
        throw new Error("Failed to update verdict");
      }

      toast.success(`Verdict set to ${verdict}`, {
        description:
          verdict === "guilty" ? "Tool flagged." : "Dispute dismissed.",
      });

      router.refresh();
    } catch (_error) {
      toast.error("Error updating verdict");
    } finally {
      setIsUpdating(false);
    }
  };

  const verdictColor = {
    pending: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
    manual_review: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20",
    guilty: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
    innocent: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  };

  const reasonLabels: Record<string, string> = {
    schema_mismatch: "Schema Mismatch",
    execution_error: "Execution Error",
    malicious_content: "Malicious Content",
    data_fabrication: "Data Fabrication",
  };

  const contractAddress = process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS || "";

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{dispute.toolName}</span>
          <span className="max-w-[120px] truncate font-mono text-muted-foreground text-xs">
            {dispute.transactionHash.slice(0, 8)}...
            {dispute.transactionHash.slice(-6)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge className="whitespace-nowrap" variant="outline">
          {reasonLabels[dispute.reason] || dispute.reason}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          className={`border-0 ${verdictColor[dispute.verdict as keyof typeof verdictColor] || ""}`}
          variant="secondary"
        >
          {dispute.verdict.replace("_", " ")}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[200px]">
        {dispute.details ? (
          <p
            className="truncate text-muted-foreground text-xs"
            title={dispute.details}
          >
            {dispute.details}
          </p>
        ) : (
          <span className="text-muted-foreground text-xs italic">
            No details
          </span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
        {formatDistanceToNow(new Date(dispute.createdAt), { addSuffix: true })}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {/* Actions depending on state */}
          {(dispute.verdict === "pending" ||
            dispute.verdict === "manual_review") && (
            <>
              <Button
                className="h-8 gap-2"
                disabled={isUpdating}
                onClick={() => handleVerdict("innocent")}
                size="sm"
                variant="outline"
              >
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                Dismiss
              </Button>
              <Button
                className="h-8 gap-2"
                disabled={isUpdating}
                onClick={() => handleVerdict("guilty")}
                size="sm"
                variant="destructive"
              >
                <XCircle className="h-4 w-4" />
                Guilty
              </Button>
            </>
          )}

          {/* Hard Slash Button if Guilty and Staked */}
          {dispute.verdict === "guilty" &&
            // Only if tool has stake (though logic is complicated, we check totalStaked > 0)
            // We'll pass the amount from somewhere, or default to checking via API.
            // For now, let's assume we slash everything or a fixed amount?
            // The prompt example said "Slash Stake" button appears.
            // We need the stake amount to pre-fill.
            // dispute.totalStaked is string.
            (Number(dispute.totalStaked || 0) > 0 ? (
              <SlashButton
                amount={dispute.totalStaked || "0"}
                contractAddress={contractAddress}
                disputeId={dispute.id}
                toolId={dispute.toolId} // Full slash? Or partial? Let's default to full for now or prompt
                // Actually, Phase 2 spec says "Confirmation modal shows amount".
                toolName={dispute.toolName}
              />
            ) : (
              <span className="text-muted-foreground text-xs">No Stake</span>
            ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-8 w-8" size="icon" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() =>
                  navigator.clipboard.writeText(dispute.transactionHash)
                }
              >
                Copy Tx Hash
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(dispute.toolId)}
              >
                Copy Tool ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                View Transaction <ExternalLink className="ml-2 h-3 w-3" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
