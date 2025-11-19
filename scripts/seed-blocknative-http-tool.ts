/**
 * Seed script to add the Blocknative HTTP tool to the database.
 * Run with: pnpm tsx scripts/seed-blocknative-http-tool.ts
 */

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { aiTool, user } from "@/lib/db/schema";

async function seedBlocknativeHttpTool() {
  try {
    config({ path: ".env.local" });
    if (!process.env.POSTGRES_URL) {
      throw new Error("POSTGRES_URL is not defined in .env.local");
    }
    const client = postgres(process.env.POSTGRES_URL, { max: 1 });
    const db = drizzle(client);

    const externalEndpoint =
      process.env.BLOCKNATIVE_CONTEXT_ENDPOINT ||
      "http://localhost:4001/context/blocknative";

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const developerEmail = "dev+blocknative-http@context.local";

    const [developer] = await db
      .select()
      .from(user)
      .where(eq(user.email, developerEmail));

    const devRecord =
      developer ??
      (
        await db
          .insert(user)
          .values({
            email: developerEmail,
            walletAddress:
              process.env.PLATFORM_TREASURY_ADDRESS ||
              "0x0000000000000000000000000000000000000000",
            isDeveloper: true,
          })
          .returning()
      )[0];

    const existingTools = await db
      .select()
      .from(aiTool)
      .where(eq(aiTool.name, "Blocknative Gas (HTTP)"));

    if (existingTools.length > 0) {
      console.log(
        "Blocknative HTTP tool already exists:",
        existingTools[0].id
      );
      return;
    }

    const [inserted] = await db
      .insert(aiTool)
      .values({
        name: "Blocknative Gas (HTTP)",
        description:
          "Query Blocknative's gas prices, supported chains, oracles, and related metadata via the contributor-hosted Context SDK endpoint.",
        developerId: devRecord.id,
        developerWallet:
          devRecord.walletAddress ||
          "0x0000000000000000000000000000000000000000",
        pricePerQuery: "0.01",
        toolSchema: {
          kind: "http",
          endpoint: externalEndpoint,
          defaultParams: {
            endpoint: "gas_price",
            chainId: 8453,
            confidence: 90,
          },
          usage:
            'callHttpTool({ toolId: "TOOL_ID", input: { endpoint: "gas_price", chainId: 8453, confidence: 90 } })',
        },
        apiEndpoint: `${baseUrl}/api/tools/execute`,
        category: "Network",
        isActive: true,
        isVerified: true,
      })
      .returning();

    console.log("✅ Seeded Blocknative HTTP tool:", inserted.id);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seedBlocknativeHttpTool().then(() => {
  console.log("Done.");
  process.exit(0);
});



