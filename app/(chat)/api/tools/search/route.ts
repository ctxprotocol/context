import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { searchAITools, trackEngagementEvent } from "@/lib/db/queries";

const LOG_PREFIX = "[api/tools/search]";

/**
 * GET /api/tools/search?q=query&limit=20
 *
 * Semantic search for AI tools using pgvector.
 * Falls back to LIKE search if vector search fails.
 *
 * Protocol Ledger: Tracks MARKETPLACE_SEARCH events for TGE allocation.
 */
export async function GET(request: Request) {
  const startTime = performance.now();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;

  console.log(LOG_PREFIX, "Request received:", { query, limit });

  // Track search event for Protocol Ledger (fire and forget)
  const session = await auth();
  if (session?.user?.id && query.trim().length > 0) {
    trackEngagementEvent({
      userId: session.user.id,
      eventType: "MARKETPLACE_SEARCH",
      metadata: { query, limit },
    });
  }

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
