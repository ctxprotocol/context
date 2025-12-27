import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL not set");
}

const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  const results = await db.execute(sql`
    SELECT 
      name,
      description,
      category,
      tool_schema as "toolSchema"
    FROM "AITool"
    WHERE is_active = true
    AND LOWER(name) NOT LIKE '%blocknative%'
    ORDER BY total_queries DESC
  `);

  // Print each tool name and its tools
  for (const tool of results as Array<{
    name: string;
    description: string;
    category: string;
    toolSchema: { tools?: Array<{ name: string; description?: string }> };
  }>) {
    console.log("\n======================================");
    console.log("TOOL:", tool.name);
    console.log("Category:", tool.category);
    console.log(
      "Description:",
      tool.description?.slice(0, 200) + (tool.description?.length > 200 ? "..." : "")
    );

    if (tool.toolSchema?.tools) {
      console.log("\nMCP Methods:");
      for (const mcpTool of tool.toolSchema.tools) {
        console.log(
          `  - ${mcpTool.name}: ${mcpTool.description?.slice(0, 120)}${(mcpTool.description?.length ?? 0) > 120 ? "..." : ""}`
        );
      }
    }
  }
  process.exit(0);
}

main();



