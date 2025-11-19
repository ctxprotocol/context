"use client";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { verifyToolAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { AITool } from "@/lib/db/schema";

export function ToolRow({ 
  tool, 
  developerEmail 
}: { 
  tool: AITool; 
  developerEmail: string | null 
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      await verifyToolAction(tool.id, !tool.isVerified);
    } finally {
      setIsLoading(false);
    }
  };

  const kind = (tool.toolSchema as any)?.kind || "http";
  const endpoint = (tool.toolSchema as any)?.kind === "http" 
    ? (tool.toolSchema as any).endpoint 
    : (tool.toolSchema as any)?.skill?.module;

  return (
    <TableRow className="hover:bg-muted/50 border-b border-border/50 last:border-none">
      <TableCell className="pl-6">
        <Badge 
          variant={tool.isVerified ? "default" : "secondary"}
          className="font-normal"
        >
          {tool.isVerified ? "Verified" : "Pending"}
        </Badge>
      </TableCell>
      <TableCell className="font-medium text-sm text-foreground">
        {tool.name}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
          {kind}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[300px] truncate font-mono text-xs text-muted-foreground">
        {endpoint}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {developerEmail || "Unknown"}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        ${Number(tool.pricePerQuery).toFixed(2)}
      </TableCell>
      <TableCell className="text-right pr-6">
        <Button 
          variant={tool.isVerified ? "ghost" : "default"} 
          size="sm"
          onClick={handleToggle}
          disabled={isLoading}
          className={tool.isVerified ? "text-destructive hover:text-destructive hover:bg-destructive/10" : ""}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : tool.isVerified ? (
            "Unverify"
          ) : (
            "Verify"
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}

