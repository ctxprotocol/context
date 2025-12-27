import { importPKCS8, SignJWT } from "jose";

// Load from env: A PEM encoded PKCS8 private key
// Format: "-----BEGIN PRIVATE KEY-----\n..."
const PRIVATE_KEY = process.env.CONTEXT_PROTOCOL_PRIVATE_KEY;

/**
 * Generates a signed JWT to authenticate the platform to an MCP tool.
 * Uses RS256 asymmetric signing.
 *
 * The token contains:
 * - iss: "https://ctxprotocol.com" (issuer)
 * - aud: The tool endpoint URL (audience)
 * - toolId: The database ID of the tool being called
 * - iat: Issue time
 * - exp: Expiration (2 minutes for replay attack prevention)
 *
 * @param toolId - The database ID of the MCP tool
 * @param endpoint - The MCP server endpoint URL (used as audience)
 * @returns Signed JWT string, or null if signing is unavailable
 */
export async function generateServiceToken(
  toolId: string,
  endpoint: string
): Promise<string | null> {
  if (!PRIVATE_KEY) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[Auth] CONTEXT_PROTOCOL_PRIVATE_KEY is missing in production!"
      );
    } else {
      console.warn(
        "[Auth] No private key found. Skipping request signing (Dev Mode)."
      );
    }
    return null;
  }

  try {
    const alg = "RS256";
    // If the key is base64 encoded in env (common for Vercel), decode it.
    // Otherwise assume it's the raw PEM string.
    const pem = PRIVATE_KEY.includes("PRIVATE KEY")
      ? PRIVATE_KEY
      : Buffer.from(PRIVATE_KEY, "base64").toString("utf-8");

    const privateKey = await importPKCS8(pem, alg);

    return new SignJWT({ toolId })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setIssuer("https://ctxprotocol.com")
      .setAudience(endpoint)
      .setExpirationTime("2m") // Short expiration to prevent replay attacks
      .sign(privateKey);
  } catch (error) {
    console.error("[Auth] Failed to sign service token:", error);
    return null;
  }
}

/**
 * Generates a signed JWT for smoke testing during tool submission.
 * Similar to generateServiceToken but uses a placeholder toolId since
 * the tool doesn't exist in the database yet.
 *
 * The smoke test token uses:
 * - iss: "https://ctxprotocol.com" (issuer)
 * - aud: The tool endpoint URL (audience)
 * - toolId: "smoke-test" (placeholder - tool not yet created)
 * - purpose: "smoke-test" (indicates this is a verification call)
 * - iat: Issue time
 * - exp: Expiration (2 minutes)
 *
 * @param endpoint - The MCP server endpoint URL being tested
 * @returns Signed JWT string, or null if signing is unavailable
 */
export async function generateSmokeTestToken(
  endpoint: string
): Promise<string | null> {
  if (!PRIVATE_KEY) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[Auth] CONTEXT_PROTOCOL_PRIVATE_KEY is missing in production!"
      );
    } else {
      console.warn(
        "[Auth] No private key found. Skipping smoke test signing (Dev Mode)."
      );
    }
    return null;
  }

  try {
    const alg = "RS256";
    const pem = PRIVATE_KEY.includes("PRIVATE KEY")
      ? PRIVATE_KEY
      : Buffer.from(PRIVATE_KEY, "base64").toString("utf-8");

    const privateKey = await importPKCS8(pem, alg);

    return new SignJWT({ toolId: "smoke-test", purpose: "smoke-test" })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setIssuer("https://ctxprotocol.com")
      .setAudience(endpoint)
      .setExpirationTime("2m")
      .sign(privateKey);
  } catch (error) {
    console.error("[Auth] Failed to sign smoke test token:", error);
    return null;
  }
}






