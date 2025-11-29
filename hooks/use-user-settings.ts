"use client";

import { useEffect, useState } from "react";
import type { UserTier } from "@/lib/ai/entitlements";

type BYOKProvider = "kimi" | "gemini" | "anthropic" | null;

export type UserSettings = {
  tier: UserTier;
  useBYOK: boolean;
  byokProvider: BYOKProvider;
  configuredProviders: ("kimi" | "gemini" | "anthropic")[];
  freeQueriesUsedToday: number;
  freeQueriesDailyLimit: number;
};

const DEFAULT_SETTINGS: UserSettings = {
  tier: "free",
  useBYOK: false,
  byokProvider: null,
  configuredProviders: [],
  freeQueriesUsedToday: 0,
  freeQueriesDailyLimit: 20,
};

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setSettings({
            tier: data.tier || "free",
            useBYOK: data.useBYOK || false,
            byokProvider: data.byokProvider || null,
            configuredProviders: data.configuredProviders || [],
            freeQueriesUsedToday: data.freeQueriesUsedToday || 0,
            freeQueriesDailyLimit: data.freeQueriesDailyLimit || 20,
          });
        }
      } catch (_error) {
        // Use defaults on error
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  return { settings, loading };
}

