import { config } from "dotenv";

config({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

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

  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

main();
