/**
 * Seed script to add the Echo tool to the database
 * Run with: npx tsx scripts/seed-echo-tool.ts
 */

import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { aiTool, user } from "../lib/db/schema";

async function seedEchoTool() {
  try {
    // Find or create a test developer user
    let testUser = await db.query.user.findFirst({
      where: eq(user.email, "developer@test.com"),
    });

    if (!testUser) {
      console.log("Creating test developer user...");
      [testUser] = await db
        .insert(user)
        .values({
          email: "developer@test.com",
          walletAddress: "0x1234567890123456789012345678901234567890",
          isDeveloper: true,
        })
        .returning();
    }

    // Check if echo tool already exists
    const existingTool = await db.query.aiTool.findFirst({
      where: eq(aiTool.name, "Echo Tool"),
    });

    if (existingTool) {
      console.log("Echo tool already exists:", existingTool.id);
      return;
    }

    // Create the echo tool
    console.log("Creating Echo tool...");
    const [tool] = await db
      .insert(aiTool)
      .values({
        name: "Echo Tool",
        description:
          "A simple test tool that echoes back your input. Perfect for testing the marketplace!",
        developerId: testUser.id,
        developerWallet:
          testUser.walletAddress ||
          "0x1234567890123456789012345678901234567890",
        pricePerQuery: "0.01",
        toolSchema: {
          name: "echo",
          description: "Echo back the input",
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The message to echo back",
              },
            },
          },
        },
        apiEndpoint: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/tools/echo`,
        category: "Utility",
        isActive: true,
        isVerified: true, // Auto-verify for MVP
      })
      .returning();

    console.log("✅ Echo tool created successfully!");
    console.log("Tool ID:", tool.id);
    console.log("Tool Name:", tool.name);
    console.log("Price:", tool.pricePerQuery, "USDC");
  } catch (error) {
    console.error("Error seeding echo tool:", error);
    throw error;
  }
}

seedEchoTool()
  .then(() => {
    console.log("Seed complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
