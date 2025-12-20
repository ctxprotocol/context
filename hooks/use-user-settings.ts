"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
type BYOKProvider = "gemini" | "anthropic" | null;

// Note: "free" is a legacy tier that may still exist in database
// New users default to "convenience", but we accept "free" for backwards compatibility
type LegacyUserTier = "free" | "convenience" | "byok";

export type UserSettings = {
  tier: LegacyUserTier;
  useBYOK: boolean;
  byokProvider: BYOKProvider;
  configuredProviders: ("gemini" | "anthropic")[];
  accumulatedModelCost: string;
};

const DEFAULT_SETTINGS: UserSettings = {
  tier: "convenience",
  useBYOK: false,
  byokProvider: null,
  configuredProviders: [],
  accumulatedModelCost: "0",
};

const SETTINGS_CACHE_KEY = "context-user-settings";

// Try to get cached settings from sessionStorage
function getCachedSettings(): UserSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(SETTINGS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore errors
  }
  return null;
}

// Cache settings to sessionStorage
function cacheSettings(settings: UserSettings) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore errors
  }
}

const fetcher = async (url: string): Promise<UserSettings> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch settings");
  }
  const data = await response.json();
  const settings: UserSettings = {
    tier: data.tier || "convenience",
    useBYOK: data.useBYOK || false,
    byokProvider: data.byokProvider || null,
    configuredProviders: data.configuredProviders || [],
    accumulatedModelCost: data.accumulatedModelCost || "0",
  };
  // Cache for instant hydration on next page load
  cacheSettings(settings);
  return settings;
};

export function useUserSettings() {
  // Start with cached settings if available for instant hydration
  const [initialSettings] = useState<UserSettings>(() => {
    const cached = getCachedSettings();
    return cached || DEFAULT_SETTINGS;
  });

  const { data, error, isLoading, mutate } = useSWR<UserSettings>(
    "/api/settings",
    fetcher,
    {
      fallbackData: initialSettings,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // 5 seconds
    }
  );

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    settings: data || DEFAULT_SETTINGS,
    loading: isLoading,
    error,
    refresh,
  };
}

// Clear cached settings (call on logout)
export function clearUserSettingsCache() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SETTINGS_CACHE_KEY);
  } catch {
    // Ignore
  }
}
