import {
  desc,
  eq,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { aiTool, user, type AITool } from "@/lib/db/schema";

export async function getAdminTools() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }
  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client);

  const tools = await db
    .select({
      tool: aiTool,
      developerEmail: user.email,
    })
    .from(aiTool)
    .leftJoin(user, eq(aiTool.developerId, user.id))
    .orderBy(desc(aiTool.createdAt));

  return tools;
}

export async function toggleToolVerification(toolId: string, isVerified: boolean) {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }
  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client);

  await db
    .update(aiTool)
    .set({ isVerified })
    .where(eq(aiTool.id, toolId));
}

