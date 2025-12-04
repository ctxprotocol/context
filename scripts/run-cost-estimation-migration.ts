/**
 * Run the Dynamic Model Cost Estimation migration
 * 
 * Usage: npx tsx scripts/run-cost-estimation-migration.ts
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import postgres from "postgres";

config({
  path: ".env.local",
});

const runMigration = async () => {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }

  const sql = postgres(process.env.POSTGRES_URL);
  
  console.log("⏳ Running Dynamic Model Cost Estimation migration...");
  
  try {
    // Read and execute the SQL file
    const migrationSQL = readFileSync(
      "./lib/db/migrations/0014_dynamic_cost_estimation.sql",
      "utf8"
    );
    
    await sql.unsafe(migrationSQL);
    
    console.log("✅ Migration completed successfully!");
    
    // Verify the tables were created
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ModelCostHistory', 'FlowCostMultipliers')
    `;
    
    console.log("📋 Created tables:", tables.map(t => t.table_name).join(", "));
    
    // Show seeded multipliers
    const multipliers = await sql`SELECT * FROM "FlowCostMultipliers"`;
    console.log("📊 Seeded multipliers:", multipliers.length, "records");
    for (const m of multipliers) {
      console.log(`   - ${m.model_id} / ${m.flow_type}: ${m.multiplier}x`);
    }
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
};

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));


