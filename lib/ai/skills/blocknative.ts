const BLOCKNATIVE_BASE_URL = "https://api.blocknative.com";

export type BlocknativeEndpoint = "gas_price" | "chains" | "oracles";

export type BlocknativeSkillParams = {
  endpoint?: BlocknativeEndpoint;
  chainId?: number;
  system?: string;
  network?: string;
  confidence?: number;
};

export type BlocknativeGasEstimate = {
  confidence: number;
  maxFeePerGasGwei: number;
  maxPriorityFeePerGasGwei: number;
  estimatedSeconds: number;
};

export type BlocknativeSkillResult = {
  endpoint: BlocknativeEndpoint;
  request: {
    chainId: number | null;
    system: string | null;
    network: string | null;
    confidence: number | null;
  };
  fetchedAt: string;
  /**
   * Parsed subset of useful data for each supported endpoint. We retain the
   * original payload in `raw` so the LLM can inspect additional fields if
   * necessary, but the structured subset keeps summaries deterministic.
   */
  data:
    | {
        type: "gas_price";
        chainId: number | null;
        estimates: BlocknativeGasEstimate[];
      }
    | {
        type: "chains";
        chains: { chainId: number; system: string; network: string }[];
      }
    | {
        type: "oracles";
        oracles: { name: string; system: string; network: string }[];
      };
  raw: unknown;
};

const DEFAULT_CHAIN_ID = 8453; // Base mainnet

function buildUrl({
  endpoint = "gas_price",
  chainId,
  system,
  network,
  confidence,
}: BlocknativeSkillParams) {
  const searchParams = new URLSearchParams();
  let path = "/gasprices/blockprices";

  if (endpoint === "chains") {
    path = "/gasprices/chains";
  } else if (endpoint === "oracles") {
    path = "/gasprices/oracles";
  } else {
    // default endpoint is gas_price
    const resolvedChainId = chainId ?? (system && network ? undefined : DEFAULT_CHAIN_ID);
    if (resolvedChainId) {
      searchParams.set("chainid", String(resolvedChainId));
    }
    if (system && network) {
      searchParams.set("system", system);
      searchParams.set("network", network);
    }
    if (typeof confidence === "number") {
      searchParams.set("confidence", String(confidence));
    }
  }

  if (endpoint === "oracles") {
    if (chainId) {
      searchParams.set("chainid", String(chainId));
    } else if (system && network) {
      searchParams.set("system", system);
      searchParams.set("network", network);
    }
  }

  const url = new URL(path, BLOCKNATIVE_BASE_URL);
  const qs = searchParams.toString();
  if (qs) {
    url.search = qs;
  }
  return url;
}

function parseGasPricePayload(payload: any): BlocknativeGasEstimate[] {
  if (!payload?.blockPrices || !Array.isArray(payload.blockPrices)) {
    return [];
  }

  return payload.blockPrices.flatMap((block: any) => {
    if (!Array.isArray(block.estimatedPrices)) {
      return [];
    }
    return block.estimatedPrices.map((estimate: any) => ({
      confidence: Number(estimate.confidence || 0),
      maxFeePerGasGwei: Number(estimate.maxFeePerGas || 0),
      maxPriorityFeePerGasGwei: Number(estimate.maxPriorityFeePerGas || 0),
      estimatedSeconds: Number(estimate.estimatedSeconds || 0),
    }));
  });
}

function parseChainsPayload(payload: any) {
  if (!Array.isArray(payload?.chains)) {
    return [];
  }
  return payload.chains.map((chain: any) => ({
    chainId: Number(chain.chainId),
    system: chain.system,
    network: chain.network,
  }));
}

function parseOraclesPayload(payload: any) {
  if (!Array.isArray(payload?.oracles)) {
    return [];
  }
  return payload.oracles.map((oracle: any) => ({
    name: oracle.name,
    system: oracle.system,
    network: oracle.network,
  }));
}

export async function fetchBlocknativeData(
  params: BlocknativeSkillParams = {}
): Promise<BlocknativeSkillResult> {
  const apiKey = process.env.BLOCKNATIVE_API_KEY;
  if (!apiKey) {
    throw new Error("BLOCKNATIVE_API_KEY is not configured");
  }

  const { endpoint = "gas_price", chainId, system, network, confidence } = params;
  const url = buildUrl({ endpoint, chainId, system, network, confidence });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Blocknative request failed (${response.status}): ${text.slice(0, 200)}`
    );
  }

  const payload = await response.json();
  let data: BlocknativeSkillResult["data"];

  if (endpoint === "chains") {
    data = {
      type: "chains",
      chains: parseChainsPayload(payload),
    };
  } else if (endpoint === "oracles") {
    data = {
      type: "oracles",
      oracles: parseOraclesPayload(payload),
    };
  } else {
    data = {
      type: "gas_price",
      chainId: chainId ?? null,
      estimates: parseGasPricePayload(payload),
    };
  }

  return {
    endpoint,
    request: {
      chainId: chainId ?? null,
      system: system ?? null,
      network: network ?? null,
      confidence: confidence ?? null,
    },
    fetchedAt: new Date().toISOString(),
    data,
    raw: payload,
  };
}






