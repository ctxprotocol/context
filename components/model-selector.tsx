"use client";

import type { Session } from "next-auth";
import { startTransition, useMemo, useOptimistic, useState } from "react";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserSettings } from "@/hooks/use-user-settings";
import {
  entitlementsByUserType,
  getAvailableModelIds,
} from "@/lib/ai/entitlements";
import { getChatModelsForProvider } from "@/lib/ai/models";
import type { BYOKProvider } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { CheckCircleFillIcon, ChevronDownIcon } from "./icons";

// Provider display info
const PROVIDER_INFO: Record<BYOKProvider, { label: string; badge: string }> = {
  gemini: { label: "Google", badge: "BYOK" },
  anthropic: { label: "Anthropic", badge: "BYOK" },
};

export function ModelSelector({
  session,
  selectedModelId,
  className,
}: {
  session: Session;
  selectedModelId: string;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);

  const { settings, loading } = useUserSettings();
  const userType = session.user.type;
  const { availableChatModelIds } = entitlementsByUserType[userType];

  // Get models with provider-specific names based on BYOK settings
  const byokProvider: BYOKProvider | null =
    settings.tier === "byok" && settings.byokProvider
      ? (settings.byokProvider as BYOKProvider)
      : null;

  const allModelsForProvider = getChatModelsForProvider(byokProvider);

  // Filter models by:
  // 1. User type entitlements (guest vs regular)
  // 2. Tier-based availability (free vs convenience) - only for non-BYOK
  const tierModelIds = getAvailableModelIds(settings.tier);

  const availableChatModels = allModelsForProvider.filter((chatModel) => {
    // Must be in user type entitlements
    if (!availableChatModelIds.includes(chatModel.id)) {
      return false;
    }
    // For BYOK, tierModelIds is null - show all provider models
    // For Free/Convenience, filter by tier-specific models
    if (tierModelIds !== null && !tierModelIds.includes(chatModel.id)) {
      return false;
    }
    return true;
  });

  const selectedChatModel = useMemo(
    () =>
      availableChatModels.find(
        (chatModel) => chatModel.id === optimisticModelId
      ),
    [optimisticModelId, availableChatModels]
  );

  // Show provider badge for BYOK users
  const providerInfo = byokProvider ? PROVIDER_INFO[byokProvider] : null;

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          "w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
          className
        )}
      >
        <Button
          className="md:h-[34px] md:px-2"
          data-testid="model-selector"
          variant="outline"
        >
          <span className={cn(loading && "opacity-50")}>
            {selectedChatModel?.name}
          </span>
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[280px] max-w-[90vw] sm:min-w-[300px]"
      >
        {/* Show BYOK provider info at top if active */}
        {providerInfo && (
          <>
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                  {providerInfo.badge}
                </span>
                <span>Using {providerInfo.label} API key</span>
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {availableChatModels.map((chatModel) => {
          const { id } = chatModel;

          return (
            <DropdownMenuItem
              asChild
              data-active={id === optimisticModelId}
              data-testid={`model-selector-item-${id}`}
              key={id}
              onSelect={() => {
                setOpen(false);

                startTransition(() => {
                  setOptimisticModelId(id);
                  saveChatModelAsCookie(id);
                });
              }}
            >
              <button
                className="group/item flex w-full flex-row items-center justify-between gap-2 sm:gap-4"
                type="button"
              >
                <div className="flex flex-col items-start gap-1">
                  <div className="text-sm sm:text-base">{chatModel.name}</div>
                  <div className="line-clamp-2 text-muted-foreground text-xs">
                    {chatModel.description}
                  </div>
                </div>

                <div className="shrink-0 text-foreground opacity-0 group-data-[active=true]/item:opacity-100 dark:text-foreground">
                  <CheckCircleFillIcon />
                </div>
              </button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
