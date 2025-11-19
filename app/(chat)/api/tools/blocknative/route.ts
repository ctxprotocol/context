import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Blocknative Gas Platform Tool
 *
 * Wraps Blocknative Gas Platform endpoints so the tool can return:
 * - Gas prices for many chains (Gas Price API)
 *   https://docs.blocknative.com/gas-prediction/gas-platform
 * - Supported chains metadata (Chains API)
 *   https://docs.blocknative.com/gas-prediction/gas-platform-1
 * - Oracle information (Oracles API)
 *   https://docs.blocknative.com/gas-prediction/gas-platform-2
 *
 * Requires env BLOCKNATIVE_API_KEY.
 */
const requestSchema = z.object({
  input: z
    .object({
      endpoint: z
        .enum(["gas_price", "chains", "oracles"])
        .optional()
        .default("gas_price"),
      chainId: z.number().int().positive().optional(),
      system: z.string().min(1).optional(),
      network: z.string().min(1).optional(),
      confidence: z.number().int().min(1).max(100).optional(),
    })
    .optional()
    .default({}),
  toolSchema: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const apiKey = process.env.BLOCKNATIVE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "BLOCKNATIVE_API_KEY not configured" },
        { status: 500 }
      );
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid Blocknative request input",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { endpoint, chainId, system, network, confidence } =
      parsed.data.input;

    const baseUrl = "https://api.blocknative.com";

    let path = "/gasprices/blockprices";
    const searchParams = new URLSearchParams();

    if (endpoint === "chains") {
      path = "/gasprices/chains";
    } else if (endpoint === "oracles") {
      path = "/gasprices/oracles";
    }

    // For endpoints that are chain-aware, support chainId or (system, network)
    const isChainAware = endpoint === "gas_price" || endpoint === "oracles";

    if (isChainAware) {
      if (chainId) {
        searchParams.set("chainid", String(chainId));
      } else if (system && network) {
        searchParams.set("system", system);
        searchParams.set("network", network);
      } else if (endpoint === "gas_price") {
        // Default to Base mainnet (chainId 8453) if nothing is provided
        searchParams.set("chainid", "8453");
      }

      if (confidence && endpoint === "gas_price") {
        searchParams.set("confidence", String(confidence));
      }
    }

    const url = new URL(path, baseUrl);
    const queryString = searchParams.toString();
    if (queryString) {
      url.search = queryString;
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: apiKey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          error: "Failed to call Blocknative Gas Platform",
          status: res.status,
          details: text,
        },
        { status: 502 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      success: true,
      endpoint,
      request: {
        url: url.toString(),
        chainId: chainId ?? null,
        system: system ?? null,
        network: network ?? null,
        confidence: confidence ?? null,
      },
      data,
    });
  } catch (error) {
    console.error("Blocknative tool error:", error);
    return NextResponse.json(
      { error: "Blocknative gas tool failed" },
      { status: 500 }
    );
  }
}
