/**
 * Backfill Embeddings Script
 *
 * This script generates embeddings for all existing AI tools that don't have them.
 * Run this once after deploying the vector search migration.
 *
 * Usage: pnpm db:backfill-embeddings
 */

import { gateway } from "@ai-sdk/gateway";
import { embed } from "ai";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

config({ path: ".env.local" });

/**
 * Generate embedding for a text string
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const truncatedText = text.slice(0, 8000);
  const { embedding } = await embed({
    model: gateway.textEmbeddingModel("text-embedding-3-small"),
    value: truncatedText,
  });
  return embedding;
}

/**
 * Build search text from an AI tool for embedding
 */
function buildSearchText(tool: {
  name: string;
  description: string;
  category?: string | null;
  tool_schema?: Record<string, unknown> | null;
}): string {
  const parts: string[] = [tool.name, tool.description];

  if (tool.category) {
    parts.push(`Category: ${tool.category}`);
  }

  const schema = tool.tool_schema as {
    kind?: string;
    tools?: Array<{ name: string; description?: string }>;
  } | null;

  if (schema?.kind === "mcp" && schema.tools) {
    for (const skill of schema.tools) {
      parts.push(`Skill: ${skill.name}`);
      if (skill.description) {
        parts.push(skill.description);
      }
    }
  }

  return parts.join("\n");
}

/**
 * Format embedding array as PostgreSQL vector string
 */
function formatEmbeddingForPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

async function backfillEmbeddings() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }

  const client = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(client);

  console.log("⏳ Fetching tools without embeddings...");

  const tools = await db.execute(sql`
    SELECT id, name, description, category, tool_schema
    FROM "AITool"
    WHERE embedding IS NULL
  `);

  const rows = (tools as { rows?: unknown[] }).rows || tools || [];
  console.log(`Found ${rows.length} tools to embed`);

  if (rows.length === 0) {
    console.log("✅ All tools already have embeddings!");
    await client.end();
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;

  for (const tool of rows as Array<{
    id: string;
    name: string;
    description: string;
    category: string | null;
    tool_schema: Record<string, unknown> | null;
  }>) {
    try {
      const searchText = buildSearchText({
        name: tool.name,
        description: tool.description,
        category: tool.category,
        tool_schema: tool.tool_schema,
      });

      console.log(`  Generating embedding for: ${tool.name}...`);

      const embedding = await generateEmbedding(searchText);
      const embeddingStr = formatEmbeddingForPg(embedding);

      await db.execute(sql`
        UPDATE "AITool" 
        SET embedding = ${embeddingStr}::vector, search_text = ${searchText}
        WHERE id = ${tool.id}
      `);

      console.log(`  ✅ Embedded: ${tool.name}`);
      successCount++;

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`  ❌ Failed to embed ${tool.name}:`, error);
      failCount++;
    }
  }

  console.log("\n========================================");
  console.log(`✅ Successfully embedded: ${successCount} tools`);
  if (failCount > 0) {
    console.log(`❌ Failed to embed: ${failCount} tools`);
  }
  console.log("========================================\n");

  await client.end();
  process.exit(failCount > 0 ? 1 : 0);
}

backfillEmbeddings().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
