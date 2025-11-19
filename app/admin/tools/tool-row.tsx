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
    <TableRow>
      <TableCell>
        <Badge variant={tool.isVerified ? "default" : "secondary"}>
          {tool.isVerified ? "Verified" : "Pending"}
        </Badge>
      </TableCell>
      <TableCell className="font-medium">{tool.name}</TableCell>
      <TableCell>
        <Badge variant="outline">{kind}</Badge>
      </TableCell>
      <TableCell className="max-w-[300px] truncate font-mono text-xs text-muted-foreground">
        {endpoint}
      </TableCell>
      <TableCell>{developerEmail || "Unknown"}</TableCell>
      <TableCell className="text-right">${Number(tool.pricePerQuery).toFixed(2)}</TableCell>
      <TableCell className="text-right">
        <Button 
          variant={tool.isVerified ? "destructive" : "default"} 
          size="sm"
          onClick={handleToggle}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
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

