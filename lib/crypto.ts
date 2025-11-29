import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for API key encryption"
    );
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypts an API key using AES-256-GCM.
 * Returns format: iv:authTag:encryptedData (all hex encoded)
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an API key encrypted with encryptApiKey.
 * Expects format: iv:authTag:encryptedData (all hex encoded)
 */
export function decryptApiKey(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted API key format");
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * @deprecated Use validateProviderApiKey from providers.ts instead
 * Validates that an API key looks like a valid Moonshot/Kimi API key.
 * Returns true if valid format, false otherwise.
 */
export function validateApiKeyFormat(apiKey: string): boolean {
  // Moonshot API keys typically start with "sk-" and are alphanumeric
  if (!apiKey.startsWith("sk-")) {
    return false;
  }

  // Should be at least 20 characters
  if (apiKey.length < 20) {
    return false;
  }

  return true;
}

