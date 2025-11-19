"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { verifyToolAction } from "./actions";
import { toast } from "sonner";

export function VerifyButton({ toolId, isVerified }: { toolId: string; isVerified: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const result = await verifyToolAction(toolId);
      if (result.success) {
        toast.success("Tool verified successfully");
      } else {
        toast.error("Failed to verify tool");
      }
    } catch {
      toast.error("Error verifying tool");
    } finally {
      setLoading(false);
    }
  };

  if (isVerified) return null;

  return (
    <Button size="sm" variant="outline" onClick={handleVerify} disabled={loading}>
      {loading ? "Verifying..." : "Verify"}
    </Button>
  );
}

