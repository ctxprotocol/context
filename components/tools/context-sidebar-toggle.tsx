import type { ComponentProps } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { LayersIcon } from "../icons";
import { Button } from "../ui/button";

export function ContextSidebarToggle({
  className,
  onClick,
}: ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className={cn("h-8 px-2 md:h-fit md:px-2", className)}
          data-testid="context-sidebar-toggle-button"
          onClick={onClick}
          variant="outline"
        >
          <LayersIcon size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent align="start" className="hidden md:block">
        Toggle Context Tools
      </TooltipContent>
    </Tooltip>
  );
}
