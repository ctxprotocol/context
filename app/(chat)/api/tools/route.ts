import { NextResponse } from "next/server";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { createAITool, getActiveAITools } from "@/lib/db/queries";

// Default page size for pagination
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

// GET /api/tools - List all active tools with pagination
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const includeCount = searchParams.get("count") === "true";

    // Parse pagination params with bounds checking
    const limit = Math.min(
      Math.max(1, Number.parseInt(limitParam ?? "", 10) || DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const offset = Math.max(0, Number.parseInt(offsetParam ?? "", 10) || 0);

    const result = await getActiveAITools({
      limit,
      offset,
      category: category || undefined,
      includeCount,
    });

    // Handle both paginated (with count) and simple responses
    const responseData = includeCount ? result : { tools: result };

    const response = NextResponse.json(responseData);

    // Add caching headers - shorter cache to keep trust metrics fresh
    // s-maxage=30 for 30 second edge cache, stale-while-revalidate=60 for background refresh
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=30, stale-while-revalidate=60"
    );

    return response;
  } catch (error) {
    console.error("Failed to fetch tools:", error);
    return NextResponse.json(
      { error: "Failed to fetch tools" },
      { status: 500 }
    );
  }
}

// POST /api/tools - Create a new tool
const createToolSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  category: z.string().optional(),
  apiEndpoint: z.string().url(),
  toolSchema: z.record(z.unknown()),
  pricePerQuery: z.string().regex(/^\d+\.?\d*$/),
  iconUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createToolSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid tool data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      category,
      apiEndpoint,
      toolSchema,
      pricePerQuery,
      iconUrl,
    } = validation.data;

    // Get developer wallet from session/user
    // For MVP, we'll expect it to be passed or use a placeholder
    const developerWallet = body.developerWallet;

    if (!developerWallet || !ETH_ADDRESS_REGEX.test(developerWallet)) {
      return NextResponse.json(
        { error: "Valid developer wallet address required" },
        { status: 400 }
      );
    }

    const tool = await createAITool({
      name,
      description,
      developerId: session.user.id,
      developerWallet,
      pricePerQuery,
      toolSchema,
      apiEndpoint,
      category,
      iconUrl,
    });

    return NextResponse.json({ tool }, { status: 201 });
  } catch (error) {
    console.error("Failed to create tool:", error);
    return NextResponse.json(
      { error: "Failed to create tool" },
      { status: 500 }
    );
  }
}
