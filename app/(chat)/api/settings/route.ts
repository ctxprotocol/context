import { auth } from "@/app/(auth)/auth";
import type { UserTier } from "@/lib/ai/entitlements";
import {
  getProviderDisplayName,
  validateProviderApiKey,
} from "@/lib/ai/providers";
import { encryptApiKey } from "@/lib/crypto";
import {
  getUserSettings,
  hasEngagementEvent,
  trackEngagementEvent,
  upsertUserSettings,
} from "@/lib/db/queries";
import type { BYOKProvider } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";

// Provider key field mapping
// Note: Kimi/Moonshot support was removed in favor of OpenRouter
const PROVIDER_KEY_FIELDS = {
  gemini: "geminiApiKeyEncrypted",
  anthropic: "anthropicApiKeyEncrypted",
} as const;

/**
 * GET /api/settings
 * Returns the current user's settings including tier and usage stats
 */
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const settings = await getUserSettings(session.user.id);

  // Build configured providers list
  const configuredProviders: BYOKProvider[] = [];
  if (settings?.geminiApiKeyEncrypted) configuredProviders.push("gemini");
  if (settings?.anthropicApiKeyEncrypted) configuredProviders.push("anthropic");

  // Map legacy "free" tier to "convenience" (free tier was removed)
  const rawTier = settings?.tier || "convenience";
  const tier: UserTier = rawTier === "free" ? "convenience" : (rawTier as UserTier);

  return Response.json({
    tier,
    useBYOK: settings?.useBYOK || false,
    byokProvider: (settings?.byokProvider as BYOKProvider) || null,
    configuredProviders,
    enableModelCostPassthrough: settings?.enableModelCostPassthrough ?? true,
    accumulatedModelCost: settings?.accumulatedModelCost || "0",
  });
}

/**
 * POST /api/settings
 * Update user settings (tier, API key, provider selection, etc.)
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  let body: {
    tier?: UserTier;
    provider?: BYOKProvider;
    apiKey?: string | null;
    selectProvider?: BYOKProvider;
    enableModelCostPassthrough?: boolean;
  };

  try {
    body = await request.json();
  } catch (_error) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const { tier, provider, apiKey, selectProvider, enableModelCostPassthrough } =
    body;
  const updates: Record<string, unknown> = {};

  // Handle provider selection (switch active BYOK provider)
  if (selectProvider !== undefined) {
    if (!["gemini", "anthropic"].includes(selectProvider)) {
      return Response.json(
        {
          error:
            "Invalid provider. Supported: gemini, anthropic. Note: OpenAI is not supported.",
        },
        { status: 400 }
      );
    }

    // Check if the provider has a configured key
    const currentSettings = await getUserSettings(session.user.id);
    const keyField = PROVIDER_KEY_FIELDS[selectProvider];
    const hasKey = Boolean(
      currentSettings?.[keyField as keyof typeof currentSettings]
    );

    if (!hasKey) {
      return Response.json(
        {
          error: `No API key configured for ${getProviderDisplayName(selectProvider)}. Please add an API key first.`,
        },
        { status: 400 }
      );
    }

    updates.byokProvider = selectProvider;
    updates.useBYOK = true;
    updates.tier = "byok";
  }

  // Handle tier change (only convenience or byok allowed)
  if (tier !== undefined) {
    if (!["byok", "convenience"].includes(tier)) {
      return Response.json(
        { error: "Invalid tier. Must be 'byok' or 'convenience'." },
        { status: 400 }
      );
    }
    updates.tier = tier;
    updates.useBYOK = tier === "byok";
    updates.enableModelCostPassthrough = tier === "convenience";

    // If switching to convenience tier, clear byokProvider
    if (tier === "convenience") {
      updates.byokProvider = null;
    }
  }

  // Handle API key update for a specific provider
  if (provider !== undefined && apiKey !== undefined) {
    if (!["gemini", "anthropic"].includes(provider)) {
      return Response.json(
        {
          error:
            "Invalid provider. Supported: gemini, anthropic. Note: OpenAI is not supported due to their API usage tracking practices.",
        },
        { status: 400 }
      );
    }

    const keyField = PROVIDER_KEY_FIELDS[provider];

    if (apiKey === null || apiKey === "") {
      // Remove API key for this provider
      updates[keyField] = null;

      // If this was the active provider, clear BYOK settings and switch to convenience
      const currentSettings = await getUserSettings(session.user.id);
      if (currentSettings?.byokProvider === provider) {
        updates.byokProvider = null;
        updates.useBYOK = false;
        updates.tier = "convenience";
        updates.enableModelCostPassthrough = true;
      }
    } else {
      // Validate API key format
      const validation = validateProviderApiKey(provider, apiKey);
      if (!validation.valid) {
        return Response.json({ error: validation.error }, { status: 400 });
      }

      // Encrypt and store
      try {
        updates[keyField] = encryptApiKey(apiKey);

        // If no provider is currently selected, select this one
        const currentSettings = await getUserSettings(session.user.id);
        if (!currentSettings?.byokProvider) {
          updates.byokProvider = provider;
        }

        updates.useBYOK = true;
        updates.tier = "byok";

        // Protocol Ledger: Track BYOK enablement (fire and forget, deduplicated)
        // Only track once per user - power user signal for TGE
        hasEngagementEvent(session.user.id, "BYOK_ENABLED").then((alreadyTracked) => {
          if (!alreadyTracked) {
            trackEngagementEvent({
              userId: session.user.id,
              eventType: "BYOK_ENABLED",
              metadata: { provider },
            });
          }
        });
      } catch (error) {
        console.error("[settings] Failed to encrypt API key:", error);
        return Response.json(
          { error: "Failed to securely store API key. Please try again." },
          { status: 500 }
        );
      }
    }
  }

  // Handle convenience tier toggle (for backwards compatibility)
  if (enableModelCostPassthrough !== undefined) {
    updates.enableModelCostPassthrough = enableModelCostPassthrough;
    if (enableModelCostPassthrough) {
      updates.tier = "convenience";
      updates.useBYOK = false;
      updates.byokProvider = null;
    }
  }

  // Only update if there are changes
  if (Object.keys(updates).length === 0) {
    return Response.json({ success: true, message: "No changes to apply." });
  }

  await upsertUserSettings(session.user.id, updates);

  return Response.json({ success: true });
}

/**
 * DELETE /api/settings
 * Remove all API keys and reset to convenience tier
 */
export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  // Check if deleting a specific provider's key
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") as BYOKProvider | null;

  if (provider) {
    if (!["gemini", "anthropic"].includes(provider)) {
      return Response.json({ error: "Invalid provider" }, { status: 400 });
    }

    const keyField = PROVIDER_KEY_FIELDS[provider];
    const updates: Record<string, unknown> = { [keyField]: null };

    // If this was the active provider, clear BYOK settings
    const currentSettings = await getUserSettings(session.user.id);
    if (currentSettings?.byokProvider === provider) {
      // Try to switch to another configured provider
      const otherProviders: BYOKProvider[] = ["gemini", "anthropic"];
      let newProvider: BYOKProvider | null = null;

      for (const p of otherProviders) {
        if (p === provider) continue;
        const pKeyField = PROVIDER_KEY_FIELDS[p];
        if (currentSettings[pKeyField as keyof typeof currentSettings]) {
          newProvider = p;
          break;
        }
      }

      if (newProvider) {
        updates.byokProvider = newProvider;
      } else {
        // No other BYOK provider configured, switch to convenience tier
        updates.byokProvider = null;
        updates.useBYOK = false;
        updates.tier = "convenience";
        updates.enableModelCostPassthrough = true;
      }
    }

    await upsertUserSettings(session.user.id, updates);
    return Response.json({
      success: true,
      message: `${getProviderDisplayName(provider)} API key removed.`,
    });
  }

  // Delete all keys and reset to convenience tier
  await upsertUserSettings(session.user.id, {
    kimiApiKeyEncrypted: null,
    geminiApiKeyEncrypted: null,
    anthropicApiKeyEncrypted: null,
    byokProvider: null,
    useBYOK: false,
    tier: "convenience",
    enableModelCostPassthrough: true,
  });

  return Response.json({
    success: true,
    message: "All API keys removed and reset to pay-as-you-go tier.",
  });
}
