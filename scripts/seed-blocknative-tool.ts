/**
 * Seed script to add the Blocknative Gas tool to the database
 * Run with: npx tsx scripts/seed-blocknative-tool.ts
 *
 * This script creates its own Drizzle client using POSTGRES_URL.
 */

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { aiTool, user } from "../lib/db/schema";

async function seedBlocknative() {
  try {
    config({ path: ".env.local" });
    if (!process.env.POSTGRES_URL) {
      throw new Error("POSTGRES_URL is not defined in .env.local");
    }
    const client = postgres(process.env.POSTGRES_URL, { max: 1 });
    const db = drizzle(client);

    const apiKey = process.env.BLOCKNATIVE_API_KEY;
    if (!apiKey) {
      console.warn(
        "BLOCKNATIVE_API_KEY is not set – the tool will fail at runtime until provided."
      );
    }

    // Ensure a developer user exists
    const devRows = await db
      .select()
      .from(user)
      .where(eq(user.email, "dev+blocknative@context.local"));
    let dev = devRows[0];
    if (!dev) {
      const created = await db
        .insert(user)
        .values({
          email: "dev+blocknative@context.local",
          walletAddress:
            process.env.PLATFORM_TREASURY_ADDRESS ||
            "0x0000000000000000000000000000000000000000",
          isDeveloper: true,
        })
        .returning();
      dev = created[0];
    }

    const existingTools = await db
      .select()
      .from(aiTool)
      .where(eq(aiTool.name, "Blocknative Gas (Base)"));
    if (existingTools.length > 0) {
      console.log("Blocknative tool already exists:", existingTools[0].id);
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inserted = await db
      .insert(aiTool)
      .values({
        name: "Blocknative Gas (Base)",
        description:
          "Fetch real-time Base mainnet gas prices via the Blocknative Gas Platform.",
        developerId: dev.id,
        developerWallet:
          dev.walletAddress || "0x0000000000000000000000000000000000000000",
        pricePerQuery: "0.01",
        toolSchema: {
          kind: "code_execution_skill",
          skill: {
            module: "@/lib/ai/skills/blocknative",
            function: "fetchBlocknativeData",
          },
          defaultParams: {
            endpoint: "gas_price",
            chainId: 8453,
          },
          usage:
            'Call fetchBlocknativeData({ endpoint: "gas_price", chainId: 8453 }) to retrieve current Base gas prices.',
        },
        apiEndpoint: `${baseUrl}/api/tools/execute`,
        category: "Network",
        isActive: true,
        isVerified: true,
      })
      .returning();

    console.log("✅ Seeded Blocknative tool:", inserted[0].id);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
}

seedBlocknative().then(() => {
  console.log("Done.");
  process.exit(0);
});
