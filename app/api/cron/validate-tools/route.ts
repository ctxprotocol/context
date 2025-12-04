import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { aiTool } from "@/lib/db/schema";

/**
 * CRON: Tool Health Check (Level 1 - The Janitor)
 * 
 * This endpoint runs hourly via Vercel Cron to validate that marketplace tools
 * are online and returning valid responses. This provides automated trust metrics.
 * 
 * Process:
 * 1. Fetch all active tools
 * 2. Ping each tool's MCP endpoint (listTools)
 * 3. Track success/failure
 * 4. After 3 consecutive failures, auto-deactivate (soft delist)
 * 5. Update uptime_percent based on historical success rate
 * 
 * Authorization: Vercel Cron uses CRON_SECRET environment variable
 */

const LOG_PREFIX = "[cron/validate-tools]";
const CONSECUTIVE_FAILURES_THRESHOLD = 3;
const HEALTH_CHECK_TIMEOUT_MS = 10000; // 10 seconds

// Create database connection
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log(LOG_PREFIX, "Unauthorized request - missing or invalid CRON_SECRET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = performance.now();
  console.log(LOG_PREFIX, "Starting health check run");

  try {
    // Fetch all active tools
    const tools = await db
      .select({
        id: aiTool.id,
        name: aiTool.name,
        apiEndpoint: aiTool.apiEndpoint,
        consecutiveFailures: aiTool.consecutiveFailures,
        uptimePercent: aiTool.uptimePercent,
        totalQueries: aiTool.totalQueries,
      })
      .from(aiTool)
      .where(eq(aiTool.isActive, true));

    console.log(LOG_PREFIX, `Found ${tools.length} active tools to check`);

    const results = {
      checked: 0,
      passed: 0,
      failed: 0,
      deactivated: 0,
    };

    // Check each tool in parallel (with concurrency limit)
    const BATCH_SIZE = 10;
    for (let i = 0; i < tools.length; i += BATCH_SIZE) {
      const batch = tools.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((tool) => checkTool(tool, results)));
    }

    const duration = Math.round(performance.now() - startTime);
    console.log(LOG_PREFIX, `Health check complete (${duration}ms):`, results);

    return NextResponse.json({
      success: true,
      duration,
      results,
    });
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error(LOG_PREFIX, `Health check failed (${duration}ms):`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function checkTool(
  tool: {
    id: string;
    name: string;
    apiEndpoint: string;
    consecutiveFailures: number;
    uptimePercent: string | null;
    totalQueries: number;
  },
  results: { checked: number; passed: number; failed: number; deactivated: number }
) {
  results.checked++;

  try {
    // Attempt to call the MCP endpoint's listTools
    const isHealthy = await pingMCPEndpoint(tool.apiEndpoint);

    if (isHealthy) {
      // Success - reset consecutive failures and update uptime
      results.passed++;
      await updateToolHealth(tool.id, {
        consecutiveFailures: 0,
        success: true,
        currentUptime: tool.uptimePercent,
      });
      console.log(LOG_PREFIX, `✓ ${tool.name} healthy`);
    } else {
      // Failure - increment consecutive failures
      results.failed++;
      const newFailures = tool.consecutiveFailures + 1;
      
      await updateToolHealth(tool.id, {
        consecutiveFailures: newFailures,
        success: false,
        currentUptime: tool.uptimePercent,
      });

      // Auto-deactivate if threshold reached
      if (newFailures >= CONSECUTIVE_FAILURES_THRESHOLD) {
        await deactivateTool(tool.id);
        results.deactivated++;
        console.log(LOG_PREFIX, `✗ ${tool.name} DEACTIVATED after ${newFailures} failures`);
      } else {
        console.log(LOG_PREFIX, `✗ ${tool.name} failed (${newFailures}/${CONSECUTIVE_FAILURES_THRESHOLD})`);
      }
    }
  } catch (error) {
    // Network error or timeout - count as failure
    results.failed++;
    const newFailures = tool.consecutiveFailures + 1;
    
    await updateToolHealth(tool.id, {
      consecutiveFailures: newFailures,
      success: false,
      currentUptime: tool.uptimePercent,
    });

    if (newFailures >= CONSECUTIVE_FAILURES_THRESHOLD) {
      await deactivateTool(tool.id);
      results.deactivated++;
      console.log(LOG_PREFIX, `✗ ${tool.name} DEACTIVATED (error: ${error})`);
    } else {
      console.log(LOG_PREFIX, `✗ ${tool.name} error: ${error}`);
    }
  }
}

/**
 * Ping an MCP endpoint to check if it's healthy
 * Sends a minimal request and checks for valid response
 */
async function pingMCPEndpoint(endpoint: string): Promise<boolean> {
  try {
    // Determine transport type from endpoint
    const isSSE = endpoint.includes("/sse");
    
    // For health check, we do a simple HTTP request
    // Real MCP implementations would use proper MCP protocol
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Accept": "application/json, text/event-stream",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Consider 200-299 and 405 (method not allowed) as healthy
      // 405 means the server is up but expects POST for MCP
      if (response.ok || response.status === 405) {
        return true;
      }

      // For SSE endpoints, 200 with event-stream is valid
      if (isSSE && response.headers.get("content-type")?.includes("text/event-stream")) {
        return true;
      }

      return false;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch {
    return false;
  }
}

/**
 * Update tool health metrics in database
 */
async function updateToolHealth(
  toolId: string,
  { consecutiveFailures, success, currentUptime }: {
    consecutiveFailures: number;
    success: boolean;
    currentUptime: string | null;
  }
) {
  // Calculate new uptime using exponential moving average
  // This smooths out occasional failures while still reflecting overall health
  const currentUptimeNum = Number.parseFloat(currentUptime ?? "100");
  const alpha = 0.1; // Weight for new data point
  const newDataPoint = success ? 100 : 0;
  const newUptime = (alpha * newDataPoint + (1 - alpha) * currentUptimeNum).toFixed(2);

  await db
    .update(aiTool)
    .set({
      consecutiveFailures,
      uptimePercent: newUptime,
      lastHealthCheck: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiTool.id, toolId));
}

/**
 * Deactivate a tool (soft delist) after consecutive failures
 */
async function deactivateTool(toolId: string) {
  await db
    .update(aiTool)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(aiTool.id, toolId));
}

// Export config for Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds max for cron

