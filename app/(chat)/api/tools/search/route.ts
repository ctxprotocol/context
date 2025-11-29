import { NextResponse } from "next/server";
import { searchAITools } from "@/lib/db/queries";

const LOG_PREFIX = "[api/tools/search]";

/**
 * GET /api/tools/search?q=query&limit=20
 *
 * Semantic search for AI tools using pgvector.
 * Falls back to LIKE search if vector search fails.
 */
export async function GET(request: Request) {
  const startTime = performance.now();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;

  console.log(LOG_PREFIX, "Request received:", { query, limit });

  try {
    const { tools, searchType } = await searchAITools({ query, limit });
    const duration = Math.round(performance.now() - startTime);

    console.log(LOG_PREFIX, `Search complete (${duration}ms):`, {
      query,
      searchType,
      resultCount: tools.length,
    });

    return NextResponse.json({
      tools,
      query,
      searchType,
    });
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error(LOG_PREFIX, `Search failed (${duration}ms):`, error);
    return NextResponse.json(
      { error: "Search failed", tools: [], query, searchType: null },
      { status: 500 }
    );
  }
}
