/**
 * Wipe ALL user-related data from the database.
 *
 * This script is intentionally aggressive:
 * - It deletes every row from all user-related tables, regardless of whether
 *   the corresponding parent rows (e.g. in "User" or "Chat") still exist.
 * - This means it will also clean up any "orphaned" rows that might have been
 *   left behind by previous partial deletes or manual DB edits.
 *
 * Only run this against databases where it's safe to completely reset all
 * user data (e.g. local dev / preview environments).
 *
 * Run with:
 *   npx tsx scripts/wipe-all-users-and-data.ts
 *
 * It uses POSTGRES_URL from .env.local (same as migrations and seed scripts).
 */

import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

config({ path: ".env.local" });

async function wipeAllUsersAndData() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined in .env.local");
  }

  const client = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(client);

  try {
    console.log("⏳ Wiping all user-related tables (including orphaned rows)...");

    // Order matters to satisfy foreign key constraints.
    //
    // We always delete from child tables first, then parents:
    // Suggestions → Votes → Streams → Messages → ToolQuery/ToolReport
    // → Documents → Chats → Tools → Users

    // Suggestions (depends on Document + User)
    await db.execute(sql`
      DELETE FROM "Suggestion";
    `);

    // Votes (depends on Chat + Messages)
    await db.execute(sql`
      DELETE FROM "Vote_v2";
    `);

    await db.execute(sql`
      DELETE FROM "Vote";
    `);

    // Streams (depends on Chat)
    await db.execute(sql`
      DELETE FROM "Stream";
    `);

    // Messages (depend on Chat)
    await db.execute(sql`
      DELETE FROM "Message_v2";
    `);

    await db.execute(sql`
      DELETE FROM "Message";
    `);

    // Tool queries that reference chats/tools/users
    await db.execute(sql`
      DELETE FROM "ToolQuery";
    `);

    // Tool reports created by any user
    await db.execute(sql`
      DELETE FROM "ToolReport";
    `);

    // Documents (depend on User)
    await db.execute(sql`
      DELETE FROM "Document";
    `);

    // Chats (depend on User)
    await db.execute(sql`
      DELETE FROM "Chat";
    `);

    // Any tools owned or verified by users
    await db.execute(sql`
      DELETE FROM "AITool";
    `);

    // Finally delete the users themselves
    await db.execute(sql`
      DELETE FROM "User";
    `);

    console.log("✅ All users and their related data have been wiped.");
  } catch (error) {
    console.error("❌ Failed to wipe users and data:", error);
    process.exit(1);
  } finally {
    await client.end({ timeout: 5 });
  }
}

wipeAllUsersAndData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
