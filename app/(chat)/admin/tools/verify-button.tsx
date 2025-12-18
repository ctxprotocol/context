"use client";

import { StarIcon, StarOffIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LoaderIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { featureToolAction, unfeatureToolAction } from "./actions";

export function VerifyButton({
  toolId,
  isVerified,
}: {
  toolId: string;
  isVerified: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [isFeatured, setIsFeatured] = useState(isVerified);

  const handleToggleFeature = async () => {
    setLoading(true);
    try {
      if (isFeatured) {
        const result = await unfeatureToolAction(toolId);
        if (result.success) {
          setIsFeatured(false);
          toast.success("Tool removed from featured");
        } else {
          toast.error("Failed to unfeature tool");
        }
      } else {
        const result = await featureToolAction(toolId);
        if (result.success) {
          setIsFeatured(true);
          toast.success("Tool added to featured");
        } else {
          toast.error("Failed to feature tool");
        }
      }
    } catch {
      toast.error("Error updating tool");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      className="h-8 gap-1.5 shadow-sm"
      disabled={loading}
      onClick={handleToggleFeature}
      size="sm"
      variant={isFeatured ? "outline" : "default"}
    >
      {loading ? (
        <>
          <span className="animate-spin">
            <LoaderIcon size={14} />
          </span>
          {isFeatured ? "Removing..." : "Featuring..."}
        </>
      ) : isFeatured ? (
        <>
          <StarOffIcon className="size-3.5" />
          Unfeature
        </>
      ) : (
        <>
          <StarIcon className="size-3.5" />
          Feature
        </>
      )}
    </Button>
  );
}
