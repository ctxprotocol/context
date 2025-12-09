"use client";

import {
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  Moon,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { LoaderIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserTier } from "@/lib/ai/entitlements";
import { cn } from "@/lib/utils";

type BYOKProvider = "kimi" | "gemini" | "anthropic";

type SettingsData = {
  tier: UserTier;
  useBYOK: boolean;
  byokProvider: BYOKProvider | null;
  configuredProviders: BYOKProvider[];
  enableModelCostPassthrough: boolean;
  freeQueriesUsedToday: number;
  freeQueriesDailyLimit: number;
  accumulatedModelCost: string;
};

const TIER_CONFIG = {
  free: {
    name: "Free Tier",
    description: "Limited daily queries using platform resources",
    icon: Sparkles,
    badge: "default" as const,
  },
  byok: {
    name: "BYOK",
    description: "Unlimited queries with your own API key",
    icon: Key,
    badge: "secondary" as const,
  },
  convenience: {
    name: "Convenience",
    description: "Pay-as-you-go model costs",
    icon: Zap,
    badge: "outline" as const,
  },
};

const PROVIDER_CONFIG: Record<
  BYOKProvider,
  {
    name: string;
    description: string;
    placeholder: string;
    helpUrl: string;
    helpText: string;
    color: string;
    icon: React.ElementType;
  }
> = {
  kimi: {
    name: "Moonshot Kimi",
    description: "Great value, 128K context, fast responses",
    placeholder: "sk-...",
    helpUrl: "https://platform.moonshot.cn/console/api-keys",
    helpText: "Get your API key from Moonshot Console",
    color: "from-violet-500 to-purple-600",
    icon: Moon,
  },
  gemini: {
    name: "Google Gemini",
    description: "2M context, multimodal, competitive pricing",
    placeholder: "AIza...",
    helpUrl: "https://aistudio.google.com/apikey",
    helpText: "Get your API key from Google AI Studio",
    color: "from-blue-500 to-cyan-500",
    icon: Sparkles,
  },
  anthropic: {
    name: "Anthropic Claude",
    description: "Premium quality, best for complex reasoning",
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpText: "Get your API key from Anthropic Console",
    color: "from-orange-500 to-amber-500",
    icon: Brain,
  },
};

export function SettingsForm() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<BYOKProvider, string>>({
    kimi: "",
    gemini: "",
    anthropic: "",
  });
  const [showKeys, setShowKeys] = useState<Record<BYOKProvider, boolean>>({
    kimi: false,
    gemini: false,
    anthropic: false,
  });
  const [expandedProvider, setExpandedProvider] = useState<BYOKProvider | null>(
    null
  );

  // Fetch current settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        } else {
          toast.error("Failed to load settings");
        }
      } catch (_error) {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const refreshSettings = async () => {
    const response = await fetch("/api/settings");
    if (response.ok) {
      const data = await response.json();
      setSettings(data);
      // Also invalidate the SWR cache so model selector updates immediately
      mutate("/api/settings", data, { revalidate: false });
    }
  };

  const handleSaveApiKey = async (provider: BYOKProvider) => {
    const key = apiKeys[provider];
    if (!key.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          `${PROVIDER_CONFIG[provider].name} API key saved! You're now on BYOK tier.`
        );
        setApiKeys((prev) => ({ ...prev, [provider]: "" }));
        setExpandedProvider(null);
        await refreshSettings();
      } else {
        toast.error(data.error || "Failed to save API key");
      }
    } catch (_error) {
      toast.error("Failed to save API key");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveApiKey = async (provider: BYOKProvider) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/settings?provider=${provider}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "API key removed");
        await refreshSettings();
      } else {
        toast.error(data.error || "Failed to remove API key");
      }
    } catch (_error) {
      toast.error("Failed to remove API key");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectProvider = async (provider: BYOKProvider) => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectProvider: provider }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Switched to ${PROVIDER_CONFIG[provider].name}`);
        await refreshSettings();
      } else {
        toast.error(data.error || "Failed to switch provider");
      }
    } catch (_error) {
      toast.error("Failed to switch provider");
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToFreeTier = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "free" }),
      });

      if (response.ok) {
        toast.success("Switched to free tier");
        await refreshSettings();
      } else {
        toast.error("Failed to switch tier");
      }
    } catch (_error) {
      toast.error("Failed to switch tier");
    } finally {
      setSaving(false);
    }
  };

  // Switch to Convenience tier (pay-as-you-go model costs)
  const handleSwitchToConvenienceTier = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableModelCostPassthrough: true }),
      });

      if (response.ok) {
        toast.success(
          "Switched to Convenience tier. Model costs will be tracked per query."
        );
        await refreshSettings();
      } else {
        toast.error("Failed to switch tier");
      }
    } catch (_error) {
      toast.error("Failed to switch tier");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Current Tier Card Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 animate-pulse rounded-lg bg-muted" />
                <div className="space-y-2">
                  <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
                  <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
                </div>
              </div>
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded-md bg-muted" />
              </div>
              <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
            </div>
          </CardContent>
        </Card>

        {/* BYOK Providers Card Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 animate-pulse rounded-lg bg-muted" />
              <div className="space-y-2">
                <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div className="rounded-lg border p-4" key={i}>
                <div className="flex items-center gap-3">
                  <div className="size-10 animate-pulse rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-28 animate-pulse rounded-md bg-muted" />
                    <div className="h-3 w-48 animate-pulse rounded-md bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Convenience Tier Card Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 animate-pulse rounded-lg bg-muted" />
              <div className="space-y-2">
                <div className="h-5 w-36 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-56 animate-pulse rounded-md bg-muted" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Failed to load settings</p>
        </CardContent>
      </Card>
    );
  }

  const currentTier = TIER_CONFIG[settings.tier];
  const TierIcon = currentTier.icon;

  return (
    <div className="space-y-6">
      {/* Current Tier Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <TierIcon className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{currentTier.name}</CardTitle>
                <CardDescription>{currentTier.description}</CardDescription>
              </div>
            </div>
            <Badge variant={currentTier.badge}>Current</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {settings.tier === "free" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Queries used today
                </span>
                <span className="font-medium">
                  {settings.freeQueriesUsedToday} /{" "}
                  {settings.freeQueriesDailyLimit}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (settings.freeQueriesUsedToday / settings.freeQueriesDailyLimit) * 100)}%`,
                  }}
                />
              </div>
              {settings.freeQueriesUsedToday >=
                settings.freeQueriesDailyLimit && (
                <p className="text-destructive text-sm">
                  Daily limit reached. Add your own API key below to continue.
                </p>
              )}
            </div>
          )}

          {settings.tier === "byok" && settings.byokProvider && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <CheckCircle2 className="size-4 text-green-500" />
                <span>Unlimited queries with your own API key</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                {(() => {
                  const ProviderIcon =
                    PROVIDER_CONFIG[settings.byokProvider].icon;
                  return <ProviderIcon className="size-5" />;
                })()}
                <span className="font-medium">
                  {PROVIDER_CONFIG[settings.byokProvider].name}
                </span>
                <Badge className="ml-auto" variant="secondary">
                  Active
                </Badge>
              </div>
            </div>
          )}

          {settings.tier === "convenience" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Accumulated model costs
                </span>
                <span className="font-medium font-mono">
                  ${Number(settings.accumulatedModelCost).toFixed(4)}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                Model costs are paid per query and go to the platform to cover
                API expenses.
              </p>
            </div>
          )}
        </CardContent>
        {settings.tier !== "free" && (
          <CardFooter>
            <Button
              className="w-full"
              disabled={saving}
              onClick={handleSwitchToFreeTier}
              variant="outline"
            >
              Switch to Free Tier
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* BYOK Providers Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
              <Key className="size-5 text-secondary-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">
                Bring Your Own Key (BYOK)
              </CardTitle>
              <CardDescription>
                Use your own API key for unlimited queries. Choose from three
                providers.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider List */}
          {(["kimi", "gemini", "anthropic"] as BYOKProvider[]).map(
            (provider) => {
              const config = PROVIDER_CONFIG[provider];
              const isConfigured =
                settings.configuredProviders.includes(provider);
              const isActive = settings.byokProvider === provider;
              const isExpanded = expandedProvider === provider;
              const ProviderIcon = config.icon;

              return (
                <div
                  className={cn(
                    "rounded-lg border transition-all",
                    isActive && "border-primary bg-primary/5",
                    isExpanded && "ring-2 ring-primary/20"
                  )}
                  key={provider}
                >
                  {/* Provider Header */}
                  <div
                    className="flex cursor-pointer items-center gap-3 p-4"
                    onClick={() =>
                      setExpandedProvider(isExpanded ? null : provider)
                    }
                  >
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                        config.color
                      )}
                    >
                      <ProviderIcon className="size-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.name}</span>
                        {isConfigured && (
                          <Badge variant={isActive ? "default" : "secondary"}>
                            {isActive ? "Active" : "Configured"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {config.description}
                      </p>
                    </div>
                    {isConfigured && !isActive && (
                      <Button
                        disabled={saving}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProvider(provider);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Use This
                      </Button>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="space-y-4 border-t px-4 pt-3 pb-4">
                      {isConfigured ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                            <Key className="size-4 text-muted-foreground" />
                            <span className="flex-1 font-mono text-muted-foreground text-sm">
                              {config.placeholder.slice(0, 6)}••••••••••••
                            </span>
                            <Badge variant="secondary">Configured</Badge>
                          </div>
                          <div className="flex gap-2">
                            {!isActive && (
                              <Button
                                className="flex-1"
                                disabled={saving}
                                onClick={() => handleSelectProvider(provider)}
                              >
                                Switch to {config.name}
                              </Button>
                            )}
                            <Button
                              disabled={saving}
                              onClick={() => handleRemoveApiKey(provider)}
                              size="icon"
                              variant="destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-3">
                            <Label htmlFor={`apiKey-${provider}`}>
                              API Key
                            </Label>
                            <div className="relative">
                              <Input
                                autoComplete="off"
                                className="pr-10 font-mono"
                                id={`apiKey-${provider}`}
                                onChange={(e) =>
                                  setApiKeys((prev) => ({
                                    ...prev,
                                    [provider]: e.target.value,
                                  }))
                                }
                                placeholder={config.placeholder}
                                type={showKeys[provider] ? "text" : "password"}
                                value={apiKeys[provider]}
                              />
                              <Button
                                className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                                onClick={() =>
                                  setShowKeys((prev) => ({
                                    ...prev,
                                    [provider]: !prev[provider],
                                  }))
                                }
                                size="sm"
                                type="button"
                                variant="ghost"
                              >
                                {showKeys[provider] ? (
                                  <EyeOff className="size-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="size-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                            <p className="text-muted-foreground text-xs">
                              {config.helpText}:{" "}
                              <a
                                className="text-primary hover:underline"
                                href={config.helpUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                Get API Key →
                              </a>
                            </p>
                          </div>
                          <Button
                            className="w-full"
                            disabled={saving || !apiKeys[provider].trim()}
                            onClick={() => handleSaveApiKey(provider)}
                          >
                            {saving ? (
                              <span className="mr-2 animate-spin">
                                <LoaderIcon size={16} />
                              </span>
                            ) : null}
                            Save & Activate
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
          )}
        </CardContent>
      </Card>

      {/* Convenience Tier - Pay-as-you-go model costs */}
      <Card
        className={cn(
          "transition-all",
          settings.tier === "convenience" && "border-primary bg-primary/5"
        )}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-lg",
                settings.tier === "convenience"
                  ? "bg-primary/10"
                  : "bg-secondary"
              )}
            >
              <Zap
                className={cn(
                  "size-5",
                  settings.tier === "convenience"
                    ? "text-primary"
                    : "text-secondary-foreground"
                )}
              />
            </div>
            <div>
              <CardTitle className="text-lg">Convenience Tier</CardTitle>
              <CardDescription>
                Pay-as-you-go model costs without managing API keys
              </CardDescription>
            </div>
            {settings.tier === "convenience" && (
              <Badge className="ml-auto" variant="default">
                Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Pay actual model costs as a pass-through, without needing to manage
            your own API key. Model costs are estimated upfront and tracked per
            query. Works with both Manual Mode (selected tools) and Auto Mode
            (AI-discovered tools).
          </p>

          {/* Show accumulated costs when on convenience tier */}
          {settings.tier === "convenience" && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Accumulated model costs
                </span>
                <span className="font-medium font-mono">
                  ${Number(settings.accumulatedModelCost).toFixed(4)}
                </span>
              </div>
              <p className="mt-2 text-muted-foreground text-xs">
                Model costs are estimated upfront and paid to the platform. In
                agentic flows, multiple AI calls may occur per response.
              </p>
            </div>
          )}

          {/* Show enable button when not on convenience tier */}
          {settings.tier !== "convenience" && (
            <Button
              className="w-full"
              disabled={saving}
              onClick={handleSwitchToConvenienceTier}
              variant="outline"
            >
              {saving && (
                <span className="mr-2 animate-spin">
                  <LoaderIcon size={16} />
                </span>
              )}
              Switch to Convenience Tier
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Info Section */}
      <div className="rounded-lg border border-dashed p-4">
        <div>
          <h3 className="mb-2 font-medium text-sm">About API Key Security</h3>
          <ul className="space-y-1 text-muted-foreground text-xs">
            <li>• Your API keys are encrypted at rest using AES-256-GCM</li>
            <li>• Keys are never logged or exposed in our systems</li>
            <li>• You can remove your keys at any time</li>
            <li>• We recommend using dedicated keys for this app</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
