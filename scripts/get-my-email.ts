import { eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { user } from "@/lib/db/schema";

/**
 * Quick script to find your user email
 * Run: npx tsx scripts/get-my-email.ts
 */

async function main() {
  console.log("Fetching users from database...\n");

  const client = postgres(process.env.POSTGRES_URL!);
  const database = drizzle(client);

  const users = await database
    .select({
      id: user.id,
      email: user.email,
      privyDid: user.privyDid,
      walletAddress: user.walletAddress,
    })
    .from(user)
    .limit(10);

  console.log("Recent users:");
  console.log("─".repeat(80));

  for (const u of users) {
    console.log(`Email: ${u.email || "(none)"}`);
    console.log(`Privy DID: ${u.privyDid || "(none)"}`);
    console.log(`Wallet: ${u.walletAddress || "(none)"}`);
    console.log(`ID: ${u.id}`);
    console.log("─".repeat(80));
  }

  console.log("\nTo make yourself admin:");
  console.log("1. Find your email above");
  console.log("2. Add it to lib/admin.ts in the ADMIN_EMAILS array");
  console.log("3. Restart your dev server (npm run dev)");

  await client.end();
}

main().catch(console.error);
