/**
 * Wipe all users and their related data from the database.
 *
 * This is safe for your current situation because you mentioned there are only
 * two test users and no other user data in this app.
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
    console.log("⏳ Wiping all users and related data...");

    // Order matters to satisfy foreign key constraints.

    // Suggestions → Documents → Streams → Votes → Messages → Chats
    await db.execute(sql`
      DELETE FROM "Suggestion"
      WHERE "documentId" IN (
        SELECT "id" FROM "Document"
      );
    `);

    await db.execute(sql`
      DELETE FROM "Document"
      WHERE "userId" IN (
        SELECT "id" FROM "User"
      );
    `);

    await db.execute(sql`
      DELETE FROM "Stream"
      WHERE "chatId" IN (
        SELECT "id" FROM "Chat"
        WHERE "userId" IN (SELECT "id" FROM "User")
      );
    `);

    await db.execute(sql`
      DELETE FROM "Vote_v2"
      WHERE "chatId" IN (
        SELECT "id" FROM "Chat"
        WHERE "userId" IN (SELECT "id" FROM "User")
      );
    `);

    await db.execute(sql`
      DELETE FROM "Vote"
      WHERE "chatId" IN (
        SELECT "id" FROM "Chat"
        WHERE "userId" IN (SELECT "id" FROM "User")
      );
    `);

    await db.execute(sql`
      DELETE FROM "Message_v2"
      WHERE "chatId" IN (
        SELECT "id" FROM "Chat"
        WHERE "userId" IN (SELECT "id" FROM "User")
      );
    `);

    await db.execute(sql`
      DELETE FROM "Message"
      WHERE "chatId" IN (
        SELECT "id" FROM "Chat"
        WHERE "userId" IN (SELECT "id" FROM "User")
      );
    `);

    // Tool queries that reference those chats
    await db.execute(sql`
      DELETE FROM "ToolQuery"
      WHERE "chat_id" IN (
        SELECT "id" FROM "Chat"
        WHERE "userId" IN (SELECT "id" FROM "User")
      );
    `);

    await db.execute(sql`
      DELETE FROM "Chat"
      WHERE "userId" IN (
        SELECT "id" FROM "User"
      );
    `);

    // Tool queries and reports created by any user (remaining rows)
    await db.execute(sql`
      DELETE FROM "ToolQuery"
      WHERE "user_id" IN (
        SELECT "id" FROM "User"
      );
    `);

    await db.execute(sql`
      DELETE FROM "ToolReport"
      WHERE "reporter_id" IN (
        SELECT "id" FROM "User"
      );
    `);

    // Any tools owned or verified by users (if any exist)
    await db.execute(sql`
      DELETE FROM "AITool"
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
