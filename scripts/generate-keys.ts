/**
 * Generate RS256 Key Pair for Context Protocol Request Signing
 *
 * This script generates a public/private key pair for authenticating
 * the Context Platform to MCP tool servers.
 *
 * Usage:
 *   npx tsx scripts/generate-keys.ts
 *
 * Output:
 *   - PRIVATE KEY (base64 encoded): Add to .env.local as CONTEXT_PROTOCOL_PRIVATE_KEY
 *   - PUBLIC KEY (PEM format): Share with MCP tool developers for verification
 */

import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

async function main() {
  console.log("Generating RS256 Key Pair for Context Protocol...\n");

  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });

  const privatePem = await exportPKCS8(privateKey);
  const publicPem = await exportSPKI(publicKey);

  console.log(
    "=== PRIVATE KEY (Add to .env.local as CONTEXT_PROTOCOL_PRIVATE_KEY) ==="
  );
  console.log("Base64 encoded (recommended for environment variables):");
  console.log(Buffer.from(privatePem).toString("base64"));
  console.log("\nRaw PEM format:");
  console.log(privatePem);

  console.log("\n=== PUBLIC KEY (Add to SDK / Share with Tool Developers) ===");
  console.log("PEM format:");
  console.log(publicPem);

  console.log("\n=== VERIFICATION INSTRUCTIONS ===");
  console.log("1. Add CONTEXT_PROTOCOL_PRIVATE_KEY to your .env.local file");
  console.log("2. Tool developers verify requests using the public key above");
  console.log(
    "3. JWT tokens include: iss=https://ctxprotocol.com, aud=<tool-endpoint>, toolId=<tool-id>"
  );
  console.log("4. Tokens expire in 2 minutes to prevent replay attacks\n");
}

main();

