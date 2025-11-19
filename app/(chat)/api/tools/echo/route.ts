import { NextResponse } from "next/server";

/**
 * Echo Tool - Simple test tool that returns input
 * This is a basic tool for testing the marketplace
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { input } = body;

    return NextResponse.json({
      success: true,
      message: "Echo tool executed successfully",
      input: input || {},
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Echo tool error:", error);
    return NextResponse.json(
      { error: "Echo tool execution failed" },
      { status: 500 }
    );
  }
}
