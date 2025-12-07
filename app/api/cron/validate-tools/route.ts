import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { NextResponse } from "next/server";
import postgres from "postgres";
import { aiTool } from "@/lib/db/schema";

/**
 * CRON: Tool Health Check (Level 1 - The Janitor)
 *
 * This endpoint runs daily via Vercel Cron to validate that marketplace tools
 * are online and returning valid responses. This provides automated trust metrics.
 *
 * Process:
 * 1. Fetch all active tools with their MCP endpoint from tool_schema
 * 2. Ping each tool's MCP endpoint using proper MCP protocol (POST with initialize)
 * 3. Skip localhost endpoints (can't be reached from Vercel's servers)
 * 4. Track success/failure
 * 5. After 3 consecutive failures, auto-deactivate (soft delist)
 * 6. Update uptime_percent based on historical success rate
 *
 * Authorization: Vercel Cron uses CRON_SECRET environment variable
 */

const LOG_PREFIX = "[cron/validate-tools]";
const CONSECUTIVE_FAILURES_THRESHOLD = 3;
const HEALTH_CHECK_TIMEOUT_MS = 15_000; // 15 seconds (MCP can be slow)

// Create database connection
const connectionString = process.env.POSTGRES_URL ?? "";
const client = postgres(connectionString);
const db = drizzle(client);

type ToolWithEndpoint = {
  id: string;
  name: string;
  mcpEndpoint: string | null;
  consecutiveFailures: number;
  uptimePercent: string | null;
  totalQueries: number;
};

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log(
      LOG_PREFIX,
      "Unauthorized request - missing or invalid CRON_SECRET"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = performance.now();
  console.log(LOG_PREFIX, "Starting health check run");

  try {
    // Fetch all active tools with the actual MCP endpoint from tool_schema
    // The real endpoint is in tool_schema.endpoint, not the api_endpoint column
    const tools = await db.execute<ToolWithEndpoint>(sql`
      SELECT 
        id,
        name,
        tool_schema->>'endpoint' as "mcpEndpoint",
        consecutive_failures as "consecutiveFailures",
        uptime_percent as "uptimePercent",
        total_queries as "totalQueries"
      FROM "AITool"
      WHERE is_active = true
    `);

    console.log(LOG_PREFIX, `Found ${tools.length} active tools to check`);

    const results = {
      checked: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      deactivated: 0,
    };

    // Check each tool in parallel (with concurrency limit)
    const BATCH_SIZE = 5; // Reduced batch size for MCP calls
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
  tool: ToolWithEndpoint,
  results: {
    checked: number;
    passed: number;
    failed: number;
    skipped: number;
    deactivated: number;
  }
) {
  const endpoint = tool.mcpEndpoint;

  // Skip tools without a valid endpoint
  if (!endpoint) {
    console.log(LOG_PREFIX, `⊘ ${tool.name} skipped (no endpoint configured)`);
    results.skipped++;
    return;
  }

  // Skip localhost endpoints - can't be reached from Vercel's servers
  // These are development tools that shouldn't affect production health metrics
  if (
    endpoint.includes("localhost") ||
    endpoint.includes("127.0.0.1") ||
    endpoint.includes("0.0.0.0")
  ) {
    console.log(LOG_PREFIX, `⊘ ${tool.name} skipped (localhost endpoint)`);
    results.skipped++;
    return;
  }

  results.checked++;

  try {
    // Attempt to call the MCP endpoint
    const isHealthy = await pingMCPEndpoint(endpoint);

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
        console.log(
          LOG_PREFIX,
          `✗ ${tool.name} DEACTIVATED after ${newFailures} failures`
        );
      } else {
        console.log(
          LOG_PREFIX,
          `✗ ${tool.name} failed (${newFailures}/${CONSECUTIVE_FAILURES_THRESHOLD})`
        );
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
 *
 * MCP Streamable HTTP Protocol:
 * - Uses POST method with JSON-RPC body
 * - Requires Accept header: "application/json, text/event-stream"
 * - We send the "initialize" method which all MCP servers must support
 *
 * We consider the endpoint healthy if:
 * - Returns 200 with valid JSON-RPC response
 * - Returns 400/406 (server is up but rejected our request format)
 * - Returns any response within timeout (server is reachable)
 */
async function pingMCPEndpoint(endpoint: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    HEALTH_CHECK_TIMEOUT_MS
  );

  try {
    // Use proper MCP protocol: POST with JSON-RPC initialize request
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "context-health-check",
            version: "1.0.0",
          },
        },
        id: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Server responded - check if it's a valid MCP response
    // 200: Success - proper MCP response
    // 400: Bad request - server is up but may expect different format
    // 406: Not Acceptable - server is up but wants different Accept header
    // 405: Method not allowed - server prefers different HTTP method
    // Any of these means the server IS reachable and responding
    if (
      response.ok ||
      response.status === 400 ||
      response.status === 405 ||
      response.status === 406
    ) {
      // For 200 responses, verify it looks like valid JSON-RPC
      if (response.ok) {
        try {
          const contentType = response.headers.get("content-type") ?? "";
          // SSE responses are valid for MCP
          if (contentType.includes("text/event-stream")) {
            return true;
          }
          // JSON responses should have jsonrpc field
          if (contentType.includes("application/json")) {
            const body = await response.json();
            // Valid JSON-RPC response has jsonrpc field
            return "jsonrpc" in body || "result" in body || "error" in body;
          }
          // Other 200 responses - assume healthy
          return true;
        } catch {
          // Failed to parse but server responded - consider healthy
          return true;
        }
      }
      // 400/405/406 means server is up but rejected our specific request
      // This is still a "healthy" server for our purposes
      return true;
    }

    // 404, 500, 502, 503, etc. - server has issues
    console.log(
      LOG_PREFIX,
      `Endpoint returned ${response.status}: ${response.statusText}`
    );
    return false;
  } catch (error) {
    clearTimeout(timeoutId);
    // Network error, timeout, or DNS failure
    if (error instanceof Error && error.name === "AbortError") {
      console.log(LOG_PREFIX, "Endpoint timed out");
    }
    return false;
  }
}

/**
 * Update tool health metrics in database
 */
async function updateToolHealth(
  toolId: string,
  {
    consecutiveFailures,
    success,
    currentUptime,
  }: {
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
  const newUptime = (
    alpha * newDataPoint +
    (1 - alpha) * currentUptimeNum
  ).toFixed(2);

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
