import { createHash } from "node:crypto";
import { getApiKeyByHash } from "@/lib/db/queries";
import type { ApiKey, User } from "@/lib/db/schema";

/**
 * Context Protocol API Key Authentication
 *
 * API keys are used for headless/programmatic access to the marketplace.
 * Unlike browser sessions (Privy), API users are scripts/agents that cannot
 * sign transactions interactively.
 *
 * Key Format: sk_live_<32 random alphanumeric characters>
 * Storage: SHA-256 hash of the full key
 */

const API_KEY_PREFIX = "sk_live_";
const API_KEY_RANDOM_LENGTH = 32;

/**
 * Result of API key authentication
 */
export type ApiAuthResult =
  | {
      success: true;
      user: User;
      apiKey: ApiKey;
    }
  | {
      success: false;
      error: string;
      status: 401 | 403;
    };

/**
 * Generate a new API key
 * Returns both the full key (to show user once) and its hash (for storage)
 */
export function generateApiKey(): {
  fullKey: string;
  keyHash: string;
  keyPrefix: string;
} {
  // Generate 32 random alphanumeric characters
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomPart = "";
  const randomBytes = new Uint8Array(API_KEY_RANDOM_LENGTH);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < API_KEY_RANDOM_LENGTH; i++) {
    randomPart += chars[randomBytes[i] % chars.length];
  }

  const fullKey = `${API_KEY_PREFIX}${randomPart}`;
  const keyHash = hashApiKey(fullKey);
  const keyPrefix = fullKey.slice(0, 7); // "sk_live"

  return { fullKey, keyHash, keyPrefix };
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Authenticate a request using API key from Authorization header
 *
 * Expected header format: Authorization: Bearer sk_live_...
 *
 * @param request - The incoming request
 * @returns Authentication result with user info or error
 */
export async function authenticateApiKey(
  request: Request
): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return {
      success: false,
      error:
        "Missing Authorization header. Use: Authorization: Bearer sk_live_...",
      status: 401,
    };
  }

  // Parse Bearer token
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return {
      success: false,
      error: "Invalid Authorization header format. Use: Bearer sk_live_...",
      status: 401,
    };
  }

  const apiKeyValue = parts[1];

  // Validate key format
  if (!apiKeyValue.startsWith(API_KEY_PREFIX)) {
    return {
      success: false,
      error: "Invalid API key format. Keys should start with 'sk_live_'",
      status: 401,
    };
  }

  // Hash and look up the key
  const keyHash = hashApiKey(apiKeyValue);
  const result = await getApiKeyByHash(keyHash);

  if (!result) {
    return {
      success: false,
      error: "Invalid API key. Check that you're using a valid key.",
      status: 401,
    };
  }

  return {
    success: true,
    user: result.user,
    apiKey: result,
  };
}

/**
 * Create a JSON error response for API authentication failures
 */
export function apiAuthErrorResponse(
  result: Extract<ApiAuthResult, { success: false }>
): Response {
  return Response.json(
    {
      error: result.error,
      code: result.status === 401 ? "unauthorized" : "forbidden",
    },
    { status: result.status }
  );
}




