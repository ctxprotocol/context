import { eq, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { generateEmbedding, formatEmbeddingForPg } from "@/lib/ai/embeddings";
import { aiTool } from "@/lib/db/schema";

/**
 * Marketplace Search Skill
 *
 * This module enables dynamic tool discovery. The agent can search
 * the marketplace to find tools that match the user's request.
 *
 * Uses pgvector for semantic similarity search with fallback to LIKE search.
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
 * Search the marketplace for tools matching a query using semantic vector search
 *
 * @param query - Search term to match against tool embeddings
 * @param limit - Maximum number of results to return (default: 10)
 */
export async function searchMarketplace(
  query: string,
  limit = 10
): Promise<MarketplaceSearchResult[]> {
  if (!query || query.trim().length === 0) {
    throw new Error("Search query cannot be empty.");
  }

  try {
    // Try vector search first (semantic similarity)
    const results = await searchMarketplaceVector(query, limit);
    if (results.length > 0) {
      return results;
    }

    // Fallback to LIKE search if no vector results
    // (e.g., if embeddings haven't been generated yet)
    console.log("[marketplace] No vector results, falling back to LIKE search");
    return searchMarketplaceFallback(query, limit);
  } catch (error) {
    console.error("[marketplace] Vector search failed, using fallback:", error);
    // Fallback to LIKE search on any error
    return searchMarketplaceFallback(query, limit);
  }
}

/**
 * Semantic vector search using pgvector
 */
async function searchMarketplaceVector(
  query: string,
  limit: number
): Promise<MarketplaceSearchResult[]> {
  // Generate embedding for the search query
  const queryEmbedding = await generateEmbedding(query);
  const embeddingStr = formatEmbeddingForPg(queryEmbedding);

  // Search by cosine similarity using pgvector
  // The <=> operator computes cosine distance (1 - cosine_similarity)
  // Lower distance = more similar
  const results = await db.execute(sql`
    SELECT 
      id,
      name,
      description,
      price_per_query as "pricePerQuery",
      tool_schema as "toolSchema",
      category,
      is_verified as "isVerified",
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM "AITool"
    WHERE is_active = true
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `);

  // drizzle-orm/postgres-js returns rows directly as array or in .rows
  const rows = (Array.isArray(results) ? results : results.rows ?? []) as Array<Record<string, unknown>>;
  
  return rows.map((tool) => ({
    id: tool.id as string,
    name: tool.name as string,
    description: tool.description as string,
    price: (tool.pricePerQuery as string) ?? "0",
    kind: getToolKind(tool.toolSchema as Record<string, unknown> | null),
    category: tool.category as string | null,
    isVerified: tool.isVerified as boolean,
  }));
}

/**
 * Fallback LIKE search (used when vector search is unavailable)
 */
async function searchMarketplaceFallback(
  query: string,
  limit: number
): Promise<MarketplaceSearchResult[]> {
  const searchTerm = `%${query.toLowerCase()}%`;

  const results = await db.execute(sql`
    SELECT 
      id,
      name,
      description,
      price_per_query as "pricePerQuery",
      tool_schema as "toolSchema",
      category,
      is_verified as "isVerified"
    FROM "AITool"
    WHERE is_active = true
      AND (
        LOWER(name) LIKE ${searchTerm}
        OR LOWER(description) LIKE ${searchTerm}
        OR LOWER(category) LIKE ${searchTerm}
      )
    LIMIT ${limit}
  `);

  // drizzle-orm/postgres-js returns rows directly as array or in .rows
  const rows = (Array.isArray(results) ? results : results.rows ?? []) as Array<Record<string, unknown>>;
  
  return rows.map((tool) => ({
    id: tool.id as string,
    name: tool.name as string,
    description: tool.description as string,
    price: (tool.pricePerQuery as string) ?? "0",
    kind: getToolKind(tool.toolSchema as Record<string, unknown> | null),
    category: tool.category as string | null,
    isVerified: tool.isVerified as boolean,
  }));
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
