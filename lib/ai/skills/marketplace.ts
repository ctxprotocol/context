import { like, or, eq, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { aiTool } from "@/lib/db/schema";

/**
 * Marketplace Search Skill
 *
 * This module enables dynamic tool discovery. The agent can search
 * the marketplace to find tools that match the user's request.
 *
 * This is a FREE, always-available skill that doesn't require payment.
 */

type MarketplaceSearchResult = {
  id: string;
  name: string;
  description: string;
  price: string;
  kind: "mcp" | "skill";
  category: string | null;
  isVerified: boolean;
};

// Create a separate connection for marketplace queries
// This avoids importing from lib/db/queries which has "server-only" directive
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

function getToolKind(schema: Record<string, unknown> | null): "mcp" | "skill" {
  if (schema?.kind === "mcp") {
    return "mcp";
  }
  // Default to skill for native tools
  return "skill";
}

/**
 * Search the marketplace for tools matching a query
 *
 * @param query - Search term to match against tool names and descriptions
 * @param limit - Maximum number of results to return (default: 10)
 */
export async function searchMarketplace(
  query: string,
  limit = 10
): Promise<MarketplaceSearchResult[]> {
  if (!query || query.trim().length === 0) {
    throw new Error("Search query cannot be empty.");
  }

  const searchTerm = `%${query.toLowerCase()}%`;

  try {
    const results = await db
      .select({
        id: aiTool.id,
        name: aiTool.name,
        description: aiTool.description,
        pricePerQuery: aiTool.pricePerQuery,
        toolSchema: aiTool.toolSchema,
        category: aiTool.category,
        isVerified: aiTool.isVerified,
      })
      .from(aiTool)
      .where(
        and(
          eq(aiTool.isActive, true),
          or(
            sql`LOWER(${aiTool.name}) LIKE ${searchTerm}`,
            sql`LOWER(${aiTool.description}) LIKE ${searchTerm}`,
            sql`LOWER(${aiTool.category}) LIKE ${searchTerm}`
          )
        )
      )
      .limit(limit);

    return results.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      price: tool.pricePerQuery ?? "0",
      kind: getToolKind(tool.toolSchema as Record<string, unknown> | null),
      category: tool.category,
      isVerified: tool.isVerified,
    }));
  } catch (error) {
    console.error("Marketplace search failed:", error);
    throw new Error("Failed to search the marketplace. Please try again.");
  }
}

/**
 * Get featured/popular tools from the marketplace
 * Useful for showing suggestions when no specific query is provided
 *
 * @param limit - Maximum number of results to return (default: 5)
 */
export async function getFeaturedTools(
  limit = 5
): Promise<MarketplaceSearchResult[]> {
  try {
    const results = await db
      .select({
        id: aiTool.id,
        name: aiTool.name,
        description: aiTool.description,
        pricePerQuery: aiTool.pricePerQuery,
        toolSchema: aiTool.toolSchema,
        category: aiTool.category,
        isVerified: aiTool.isVerified,
      })
      .from(aiTool)
      .where(and(eq(aiTool.isActive, true), eq(aiTool.isVerified, true)))
      .orderBy(sql`${aiTool.totalQueries} DESC`)
      .limit(limit);

    return results.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      price: tool.pricePerQuery ?? "0",
      kind: getToolKind(tool.toolSchema as Record<string, unknown> | null),
      category: tool.category,
      isVerified: tool.isVerified,
    }));
  } catch (error) {
    console.error("Failed to get featured tools:", error);
    throw new Error("Failed to get featured tools. Please try again.");
  }
}

/**
 * Get tools by category
 *
 * @param category - Category to filter by
 * @param limit - Maximum number of results to return (default: 10)
 */
export async function getToolsByCategory(
  category: string,
  limit = 10
): Promise<MarketplaceSearchResult[]> {
  try {
    const results = await db
      .select({
        id: aiTool.id,
        name: aiTool.name,
        description: aiTool.description,
        pricePerQuery: aiTool.pricePerQuery,
        toolSchema: aiTool.toolSchema,
        category: aiTool.category,
        isVerified: aiTool.isVerified,
      })
      .from(aiTool)
      .where(and(eq(aiTool.isActive, true), eq(aiTool.category, category)))
      .orderBy(sql`${aiTool.totalQueries} DESC`)
      .limit(limit);

    return results.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      price: tool.pricePerQuery ?? "0",
      kind: getToolKind(tool.toolSchema as Record<string, unknown> | null),
      category: tool.category,
      isVerified: tool.isVerified,
    }));
  } catch (error) {
    console.error("Failed to get tools by category:", error);
    throw new Error("Failed to get tools by category. Please try again.");
  }
}
