import { NextResponse } from "next/server";
import {
  getFeaturedTools,
  searchMarketplace,
} from "@/lib/ai/skills/marketplace";

const LOG_PREFIX = "[api/v1/tools/search]";

/**
 * GET /api/v1/tools/search?q=query&limit=10
 *
 * Public API endpoint for searching marketplace tools.
 * This is the Context Protocol public API for tool discovery.
 *
 * Authentication: Optional (public access)
 * Rate Limiting: Recommended at infrastructure level
 *
 * Query Parameters:
 *   - q: Search query (optional, returns featured tools if empty)
 *   - limit: Max results (default: 10, max: 50)
 *
 * Response:
 *   - tools: Array of tool objects
 *   - query: The search query used
 *   - count: Number of results returned
 */
export async function GET(request: Request) {
  const startTime = performance.now();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    Math.max(1, Number.parseInt(limitParam ?? "10", 10) || 10),
    50 // Cap at 50 results
  );

  console.log(LOG_PREFIX, "Request received:", { query, limit });

  try {
    let tools;

    if (query.trim().length === 0) {
      // Return featured tools when no query
      tools = await getFeaturedTools(limit);
    } else {
      tools = await searchMarketplace(query, limit);
    }

    const duration = Math.round(performance.now() - startTime);

    console.log(LOG_PREFIX, `Search complete (${duration}ms):`, {
      query,
      resultCount: tools.length,
    });

    // Transform to public API format
    const publicTools = tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      price: tool.price,
      category: tool.category,
      isVerified: tool.isVerified,
      kind: tool.kind,
      // Include MCP tools info for execution
      mcpTools: tool.mcpTools,
    }));

    return NextResponse.json({
      tools: publicTools,
      query,
      count: publicTools.length,
    });
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error(LOG_PREFIX, `Search failed (${duration}ms):`, error);
    return NextResponse.json(
      {
        error: "Search failed",
        message: error instanceof Error ? error.message : "Unknown error",
        tools: [],
        query,
        count: 0,
      },
      { status: 500 }
    );
  }
}
