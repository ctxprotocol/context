"use client";

import {
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  Shield,
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Note: "free" is a legacy tier that may still exist in database
// It gets treated as "convenience" in the UI
type LegacyUserTier = "free" | "convenience" | "byok";

import { cn } from "@/lib/utils";

type BYOKProvider = "gemini" | "anthropic";

type SettingsData = {
  tier: LegacyUserTier;
  useBYOK: boolean;
  byokProvider: BYOKProvider | null;
  configuredProviders: BYOKProvider[];
  enableModelCostPassthrough: boolean;
  accumulatedModelCost: string;
  // Answer Quality settings
  enableDataCompletenessCheck: boolean;
  enableResponseQualityCheck: boolean;
};

const TIER_CONFIG = {
  byok: {
    name: "BYOK",
    description: "Unlimited queries with your own API key",
    icon: Key,
    badge: "secondary" as const,
  },
  convenience: {
    name: "Pay-as-you-go",
    description: "Model + tool costs paid from your USDC wallet",
    icon: Zap,
    badge: "default" as const,
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
    gemini: "",
    anthropic: "",
  });
  const [showKeys, setShowKeys] = useState<Record<BYOKProvider, boolean>>({
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

  // Switch back to Convenience tier (from BYOK)
  const handleSwitchToConvenienceTier = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "convenience" }),
      });

      if (response.ok) {
        toast.success("Switched to pay-as-you-go tier");
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
            {[1, 2].map((i) => (
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

  // Handle legacy "free" tier values from database - treat as "convenience"
  const effectiveTier =
    settings.tier === "free" ? "convenience" : settings.tier;
  const currentTier = TIER_CONFIG[effectiveTier] || TIER_CONFIG.convenience;
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
          {effectiveTier === "byok" && settings.byokProvider && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <CheckCircle2 className="size-4 text-green-500" />
                <span>Using your own API key - no model costs from wallet</span>
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
              <Button
                className="w-full"
                disabled={saving}
                onClick={handleSwitchToConvenienceTier}
                variant="outline"
              >
                Switch to Pay-as-you-go
              </Button>
            </div>
          )}

          {effectiveTier === "convenience" && (
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
                Model costs are paid per query from your USDC wallet alongside
                tool costs.
              </p>
            </div>
          )}
        </CardContent>
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
                Power users: use your own API key to skip model costs. You still
                pay tool costs via USDC.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider List */}
          {(["gemini", "anthropic"] as BYOKProvider[]).map((provider) => {
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
                          <Label htmlFor={`apiKey-${provider}`}>API Key</Label>
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
          })}

          {/* Info Section */}
          <div className="flex items-start gap-2 rounded-md bg-blue-500/10 p-2 dark:bg-blue-500/15">
            <div className="mt-0.5 size-3.5 shrink-0 text-blue-600 dark:text-blue-500">
              <svg
                className="size-full"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
            </div>
            <div className="text-blue-600/90 text-xs leading-relaxed dark:text-blue-500/90">
              <span className="font-semibold">API Key Security:</span> Your keys
              are encrypted at rest (AES-256-GCM) and never logged. You can
              remove them at any time. We recommend using dedicated keys for
              this app.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Answer Quality Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Shield className="size-5 text-emerald-600 dark:text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Answer Quality</CardTitle>
              <CardDescription>
                Configure how thoroughly the AI verifies responses. More checks
                = more accurate but slower.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Completeness Check Toggle */}
          <AnswerQualityToggle
            description="Verify tool results contain all data needed to answer your question. Can retry with different parameters."
            enabled={settings.enableDataCompletenessCheck}
            impact="+1-2 seconds, ~500 tokens"
            onToggle={async () => {
              setSaving(true);
              try {
                const response = await fetch("/api/settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    enableDataCompletenessCheck:
                      !settings.enableDataCompletenessCheck,
                  }),
                });
                if (response.ok) {
                  await refreshSettings();
                  toast.success(
                    settings.enableDataCompletenessCheck
                      ? "Data completeness check disabled"
                      : "Data completeness check enabled"
                  );
                } else {
                  toast.error("Failed to update setting");
                }
              } catch (_error) {
                toast.error("Failed to update setting");
              } finally {
                setSaving(false);
              }
            }}
            saving={saving}
            title="Data Completeness Check"
          />

          {/* Response Quality Check Toggle - Coming Soon */}
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 opacity-60"
            )}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Response Quality Check</span>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                Verify the final response actually answers your question.
                Catches AI hallucination and misinterpretation.
              </p>
              <p className="mt-1 text-muted-foreground/70 text-xs">
                Impact: +1-2 seconds, ~500 tokens
              </p>
            </div>
            <Button disabled size="sm" variant="outline">
              Enable
            </Button>
          </div>

          {/* Info Section */}
          <div className="flex items-start gap-2 rounded-md bg-emerald-500/10 p-2 dark:bg-emerald-500/15">
            <div className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-500">
              <svg
                className="size-full"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2 L2 7 L12 12 L22 7 Z" />
                <path d="M2 17 L12 22 L22 17" />
                <path d="M2 12 L12 17 L22 12" />
              </svg>
            </div>
            <div className="text-emerald-600/90 text-xs leading-relaxed dark:text-emerald-500/90">
              <span className="font-semibold">Recommended:</span> Both checks
              enabled for financial queries and important decisions. Disable for
              faster, cheaper casual conversations.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Toggle component for Answer Quality settings
 */
function AnswerQualityToggle({
  title,
  description,
  impact,
  enabled,
  saving,
  onToggle,
}: {
  title: string;
  description: string;
  impact: string;
  enabled: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 transition-all",
        enabled ? "border-emerald-500/50 bg-emerald-500/5" : "border-border"
      )}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          <Badge variant={enabled ? "default" : "secondary"}>
            {enabled ? "ON" : "OFF"}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">{description}</p>
        <p className="mt-1 text-muted-foreground/70 text-xs">
          Impact: {impact}
        </p>
      </div>
      <Button
        disabled={saving}
        onClick={onToggle}
        size="sm"
        variant={enabled ? "default" : "outline"}
      >
        {enabled ? "Disable" : "Enable"}
      </Button>
    </div>
  );
}
