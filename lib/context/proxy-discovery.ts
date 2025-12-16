/**
 * Proxy Wallet Discovery
 *
 * Auto-discovers proxy wallet addresses from user's EOA (Externally Owned Account).
 * Many DeFi protocols use proxy wallets for trading, and positions are held there
 * rather than on the main wallet.
 *
 * Supported protocols:
 * - Polymarket (Polygon): Gnosis Safe proxies + Custom proxy wallets
 * - Hyperliquid (Arbitrum): Direct address (no proxy needed)
 *
 * Discovery methods:
 * 1. On-chain factory contract queries
 * 2. Event log scanning for ProxyCreation events
 * 3. Deterministic address computation (CREATE2)
 */

import { createPublicClient, http, getAddress, keccak256, encodePacked, type Address } from "viem";
import { polygon } from "viem/chains";

// =============================================================================
// CONSTANTS
// =============================================================================

// Polymarket contracts on Polygon
const POLYMARKET_CONTRACTS = {
  // Gnosis Safe Proxy Factory - deploys Safe wallets for MetaMask/browser wallet users
  GNOSIS_SAFE_FACTORY: "0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b" as Address,
  // Polymarket Custom Proxy Factory - deploys proxies for Magic Link users
  POLYMARKET_PROXY_FACTORY: "0xaB45c5A4B0c941a2F231C04C3f49182e1A254052" as Address,
  // Gnosis Safe Singleton (master copy)
  GNOSIS_SAFE_SINGLETON: "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552" as Address,
  // Polymarket CTF Exchange - positions are traded here
  CTF_EXCHANGE: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as Address,
} as const;

// ABI for factory contracts
// Found via Polygonscan: https://polygonscan.com/address/0xaacfeea03eb1561c4e67d661e40682bd20e3541b#readContract
const GNOSIS_SAFE_FACTORY_ABI = [
  {
    type: "event",
    name: "ProxyCreation",
    inputs: [
      { name: "proxy", type: "address", indexed: false },
      { name: "singleton", type: "address", indexed: false },
    ],
  },
  {
    type: "function",
    name: "proxyCreationCode",
    inputs: [],
    outputs: [{ type: "bytes" }],
    stateMutability: "pure",
  },
  // KEY FUNCTION: Computes proxy address for a user without needing to scan events!
  {
    type: "function",
    name: "computeProxyAddress",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

const POLYMARKET_PROXY_FACTORY_ABI = [
  {
    type: "event",
    name: "ProxyCreation",
    inputs: [
      { name: "proxy", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
    ],
  },
  // Try multiple function signatures - different factories may use different names
  {
    type: "function",
    name: "getProxy",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "computeProxyAddress",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "proxyFor",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

// =============================================================================
// TYPES
// =============================================================================

export interface DiscoveredProxy {
  /** The proxy wallet address */
  address: string;
  /** Protocol this proxy is for */
  protocol: "polymarket" | "hyperliquid";
  /** Type of proxy wallet */
  type: "gnosis_safe" | "polymarket_proxy" | "direct";
  /** The EOA that controls this proxy */
  ownerEoa: string;
  /** How we discovered this proxy */
  discoveryMethod: "factory_query" | "event_scan" | "direct_check";
  /** Whether the proxy is actually deployed on-chain */
  isDeployed: boolean;
}

export interface ProxyDiscoveryResult {
  /** The EOA we searched for */
  eoa: string;
  /** All discovered proxy wallets */
  proxies: DiscoveredProxy[];
  /** Any errors during discovery */
  errors: string[];
  /** Timestamp of discovery */
  discoveredAt: string;
}

// =============================================================================
// POLYGON CLIENT
// =============================================================================

function getPolygonClient() {
  // Use public RPC - for production, use a dedicated RPC provider
  return createPublicClient({
    chain: polygon,
    transport: http(process.env.POLYGON_RPC_URL || "https://polygon-rpc.com"),
  });
}

// =============================================================================
// POLYMARKET PROXY DISCOVERY
// =============================================================================

/**
 * Query the Gnosis Safe Factory to compute proxy address for an EOA.
 * This uses the `computeProxyAddress(address user)` function discovered on Polygonscan.
 * 
 * This is the PRIMARY method for MetaMask/browser wallet users on Polymarket.
 */
async function queryGnosisSafeFactory(
  eoa: string
): Promise<DiscoveredProxy | null> {
  const client = getPolygonClient();
  const normalizedEoa = getAddress(eoa);

  console.log("[proxy-discovery] Querying Gnosis Safe factory for:", normalizedEoa);

  try {
    // Use the computeProxyAddress function from the Gnosis Safe Factory
    const proxyAddress = await client.readContract({
      address: POLYMARKET_CONTRACTS.GNOSIS_SAFE_FACTORY,
      abi: GNOSIS_SAFE_FACTORY_ABI,
      functionName: "computeProxyAddress",
      args: [normalizedEoa],
    });

    // Zero address means no proxy for this user
    if (!proxyAddress || proxyAddress === "0x0000000000000000000000000000000000000000") {
      console.log("[proxy-discovery] Gnosis Safe factory returned zero address");
      return null;
    }

    // Verify the proxy is actually deployed (has code on-chain)
    const code = await client.getCode({ address: proxyAddress });
    const isDeployed = code !== undefined && code !== "0x";

    console.log("[proxy-discovery] Found Gnosis Safe proxy:", {
      proxy: proxyAddress,
      isDeployed,
    });

    return {
      address: proxyAddress,
      protocol: "polymarket",
      type: "gnosis_safe",
      ownerEoa: normalizedEoa,
      discoveryMethod: "factory_query",
      isDeployed,
    };
  } catch (error) {
    console.error("[proxy-discovery] Error querying Gnosis Safe factory:", error);
    return null;
  }
}

/**
 * Query Polymarket's custom proxy factory to get proxy address for an EOA.
 * This is for MagicLink (email) users who use a different proxy type.
 * 
 * Note: The factory contract may have different function signatures depending
 * on when it was deployed. We try multiple approaches.
 */
async function queryPolymarketProxyFactory(
  eoa: string
): Promise<DiscoveredProxy | null> {
  const client = getPolygonClient();
  const normalizedEoa = getAddress(eoa);

  console.log("[proxy-discovery] Querying Polymarket custom proxy factory for:", normalizedEoa);

  // Try multiple function signatures since the exact ABI may vary
  const functionNames = ["computeProxyAddress", "getProxy", "proxyFor", "proxies"];

  for (const funcName of functionNames) {
    try {
      const proxyAddress = await client.readContract({
        address: POLYMARKET_CONTRACTS.POLYMARKET_PROXY_FACTORY,
        abi: [{
          type: "function" as const,
          name: funcName,
          inputs: [{ name: "user", type: "address" }],
          outputs: [{ type: "address" }],
          stateMutability: "view" as const,
        }],
        functionName: funcName,
        args: [normalizedEoa],
      });

      // Zero address means no proxy deployed
      if (!proxyAddress || proxyAddress === "0x0000000000000000000000000000000000000000") {
        continue;
      }

      // Verify the proxy is actually deployed (has code)
      const code = await client.getCode({ address: proxyAddress });
      const isDeployed = code !== undefined && code !== "0x";

      console.log("[proxy-discovery] Found Polymarket custom proxy via", funcName, ":", {
        proxy: proxyAddress,
        isDeployed,
      });

      return {
        address: proxyAddress,
        protocol: "polymarket",
        type: "polymarket_proxy",
        ownerEoa: normalizedEoa,
        discoveryMethod: "factory_query",
        isDeployed,
      };
    } catch {
      // This function signature doesn't exist, try next
      continue;
    }
  }

  console.log("[proxy-discovery] No Polymarket custom proxy found via factory query");
  return null;
}

/**
 * Scan for Gnosis Safe proxy creation events where the EOA is the owner.
 * This finds Safe wallets that Polymarket deployed for browser wallet users.
 */
async function scanGnosisSafeProxyEvents(
  eoa: string
): Promise<DiscoveredProxy[]> {
  const client = getPolygonClient();
  const normalizedEoa = getAddress(eoa);
  const proxies: DiscoveredProxy[] = [];

  try {
    console.log("[proxy-discovery] Scanning Gnosis Safe proxy events for:", normalizedEoa);

    // Get ProxyCreation events from the Safe factory
    // We need to find events where the EOA became an owner
    // Note: The Safe factory event doesn't directly include owner, so we need
    // to check if the created Safe has this EOA as an owner

    // Get recent proxy creation events (last ~6 months of blocks)
    const currentBlock = await client.getBlockNumber();
    // Polygon has ~2 second blocks, ~6 months = ~7.5M blocks
    const fromBlock = currentBlock - BigInt(7_500_000);

    const logs = await client.getLogs({
      address: POLYMARKET_CONTRACTS.GNOSIS_SAFE_FACTORY,
      event: {
        type: "event",
        name: "ProxyCreation",
        inputs: [
          { name: "proxy", type: "address", indexed: false },
          { name: "singleton", type: "address", indexed: false },
        ],
      },
      fromBlock: fromBlock > 0n ? fromBlock : 0n,
      toBlock: "latest",
    });

    console.log("[proxy-discovery] Found", logs.length, "Safe proxy creation events");

    // For each created proxy, check if the EOA is an owner
    // This is expensive, so we limit to recent proxies
    const recentLogs = logs.slice(-100); // Check last 100 proxies max

    for (const log of recentLogs) {
      const proxyAddress = log.args.proxy;
      if (!proxyAddress) continue;

      try {
        // Check if this Safe has the EOA as owner
        // Safe uses getOwners() function
        const owners = await client.readContract({
          address: proxyAddress,
          abi: [
            {
              type: "function",
              name: "getOwners",
              inputs: [],
              outputs: [{ type: "address[]" }],
              stateMutability: "view",
            },
          ],
          functionName: "getOwners",
        });

        if (owners.some((owner) => owner.toLowerCase() === normalizedEoa.toLowerCase())) {
          console.log("[proxy-discovery] Found Safe owned by EOA:", proxyAddress);
          proxies.push({
            address: proxyAddress,
            protocol: "polymarket",
            type: "gnosis_safe",
            ownerEoa: normalizedEoa,
            discoveryMethod: "event_scan",
            isDeployed: true,
          });
        }
      } catch {
        // Not a Safe or doesn't have getOwners - skip
        continue;
      }
    }
  } catch (error) {
    console.error("[proxy-discovery] Error scanning Safe events:", error);
  }

  return proxies;
}

/**
 * Compute deterministic Gnosis Safe address using CREATE2.
 * This allows us to check if a Safe COULD exist without scanning all events.
 */
async function computePotentialSafeAddress(
  eoa: string,
  saltNonce: bigint = 0n
): Promise<string | null> {
  const client = getPolygonClient();
  const normalizedEoa = getAddress(eoa);

  try {
    // Get the proxy creation code from the factory
    const creationCode = await client.readContract({
      address: POLYMARKET_CONTRACTS.GNOSIS_SAFE_FACTORY,
      abi: GNOSIS_SAFE_FACTORY_ABI,
      functionName: "proxyCreationCode",
    });

    // Compute CREATE2 address
    // address = keccak256(0xff ++ factory ++ salt ++ keccak256(initCode))[12:]
    // The salt typically includes the owner address and a nonce

    // Standard Safe deployment uses initializer data that includes the owner
    // For simplicity, we compute a common pattern
    const salt = keccak256(
      encodePacked(
        ["address", "uint256"],
        [normalizedEoa, saltNonce]
      )
    );

    // The init code hash (this is the keccak256 of the creation code)
    const initCodeHash = keccak256(creationCode as `0x${string}`);

    // Compute CREATE2 address
    const computedAddress = keccak256(
      encodePacked(
        ["bytes1", "address", "bytes32", "bytes32"],
        ["0xff", POLYMARKET_CONTRACTS.GNOSIS_SAFE_FACTORY, salt, initCodeHash]
      )
    ).slice(26); // Take last 20 bytes (40 hex chars)

    return `0x${computedAddress}`;
  } catch (error) {
    console.error("[proxy-discovery] Error computing Safe address:", error);
    return null;
  }
}

// =============================================================================
// HYPERLIQUID
// =============================================================================

/**
 * Hyperliquid user role types from the API.
 * See: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 */
type HyperliquidRole = 
  | { role: "user" }
  | { role: "vault" }
  | { role: "subAccount"; data: { master: string } }
  | { role: "agent"; data: { user: string } }
  | { role: "missing" };

/**
 * Query Hyperliquid to determine the role of an address.
 * This tells us if it's a regular user, sub-account, agent wallet, or vault.
 */
async function queryHyperliquidUserRole(address: string): Promise<HyperliquidRole | null> {
  try {
    const response = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "userRole",
        user: address.toLowerCase(),
      }),
    });

    if (!response.ok) {
      console.warn("[proxy-discovery] Hyperliquid userRole query failed:", response.status);
      return null;
    }

    const data = await response.json() as HyperliquidRole;
    console.log("[proxy-discovery] Hyperliquid userRole:", data);
    return data;
  } catch (error) {
    console.error("[proxy-discovery] Error querying Hyperliquid userRole:", error);
    return null;
  }
}

/**
 * Discover Hyperliquid wallet addresses for an EOA.
 * 
 * Hyperliquid is simpler than Polymarket:
 * - Positions are on the main address (not a proxy)
 * - Sub-accounts and agent wallets are edge cases
 * 
 * If the EOA is a sub-account or agent, we return the master address too.
 */
async function discoverHyperliquidAddresses(eoa: string): Promise<DiscoveredProxy[]> {
  const normalizedEoa = getAddress(eoa);
  const proxies: DiscoveredProxy[] = [];

  // Always include the EOA itself
  proxies.push({
    address: normalizedEoa,
    protocol: "hyperliquid",
    type: "direct",
    ownerEoa: normalizedEoa,
    discoveryMethod: "direct_check",
    isDeployed: true,
  });

  // Check if this address has a special role
  const role = await queryHyperliquidUserRole(normalizedEoa);
  
  if (role) {
    if (role.role === "subAccount" && role.data?.master) {
      // This is a sub-account - also query the master
      console.log("[proxy-discovery] EOA is a Hyperliquid sub-account, adding master:", role.data.master);
      proxies.push({
        address: getAddress(role.data.master),
        protocol: "hyperliquid",
        type: "direct",
        ownerEoa: normalizedEoa,
        discoveryMethod: "factory_query", // Using factory_query to indicate API discovery
        isDeployed: true,
      });
    } else if (role.role === "agent" && role.data?.user) {
      // This is an agent wallet - also query the master user
      console.log("[proxy-discovery] EOA is a Hyperliquid agent wallet, adding master:", role.data.user);
      proxies.push({
        address: getAddress(role.data.user),
        protocol: "hyperliquid",
        type: "direct",
        ownerEoa: normalizedEoa,
        discoveryMethod: "factory_query",
        isDeployed: true,
      });
    }
  }

  return proxies;
}

/**
 * Simple check for standard Hyperliquid usage (backward compatibility).
 */
function checkHyperliquidDirect(eoa: string): DiscoveredProxy {
  return {
    address: getAddress(eoa),
    protocol: "hyperliquid",
    type: "direct",
    ownerEoa: getAddress(eoa),
    discoveryMethod: "direct_check",
    isDeployed: true, // EOA always "exists"
  };
}

// =============================================================================
// MAIN DISCOVERY FUNCTION
// =============================================================================

/**
 * Discover all proxy wallets associated with an EOA across supported protocols.
 *
 * This function:
 * 1. Queries known factory contracts for proxy mappings
 * 2. Scans blockchain events for proxy creation
 * 3. Computes potential deterministic addresses
 *
 * @param eoa - The user's Externally Owned Account address
 * @param options - Discovery options
 * @returns Discovery result with all found proxies
 */
export async function discoverProxyWallets(
  eoa: string,
  options: {
    /** Include Polymarket proxy discovery */
    polymarket?: boolean;
    /** Include Hyperliquid (direct, no proxy) */
    hyperliquid?: boolean;
    /** Scan events (slower but more thorough) */
    scanEvents?: boolean;
  } = {}
): Promise<ProxyDiscoveryResult> {
  const {
    polymarket = true,
    hyperliquid = true,
    scanEvents = false, // Default off for speed
  } = options;

  const normalizedEoa = getAddress(eoa);
  const proxies: DiscoveredProxy[] = [];
  const errors: string[] = [];

  console.log("[proxy-discovery] Starting discovery for EOA:", normalizedEoa, options);

  // Polymarket proxy discovery
  if (polymarket) {
    try {
      let foundProxy = false;

      // Method 1: Query the Gnosis Safe factory (for MetaMask/browser wallet users)
      // This is the PRIMARY method - most Polymarket users use MetaMask
      const gnosisSafeProxy = await queryGnosisSafeFactory(normalizedEoa);
      if (gnosisSafeProxy && gnosisSafeProxy.isDeployed) {
        proxies.push(gnosisSafeProxy);
        foundProxy = true;
        console.log("[proxy-discovery] ✅ Found Gnosis Safe proxy for Polymarket");
      }

      // Method 2: Query the Polymarket custom proxy factory (for MagicLink/email users)
      // Only try this if Gnosis Safe didn't find anything
      if (!foundProxy) {
        const polymarketProxy = await queryPolymarketProxyFactory(normalizedEoa);
        if (polymarketProxy && polymarketProxy.isDeployed) {
          proxies.push(polymarketProxy);
          foundProxy = true;
          console.log("[proxy-discovery] ✅ Found Polymarket custom proxy");
        }
      }

      // Method 3: Scan Gnosis Safe events (slower, optional fallback)
      if (!foundProxy && scanEvents) {
        console.log("[proxy-discovery] Falling back to event scanning...");
        const safeProxies = await scanGnosisSafeProxyEvents(normalizedEoa);
        proxies.push(...safeProxies);
        if (safeProxies.length > 0) {
          console.log("[proxy-discovery] ✅ Found proxy via event scan");
        }
      }

      if (!foundProxy && proxies.filter(p => p.protocol === "polymarket").length === 0) {
        console.log("[proxy-discovery] ⚠️ No Polymarket proxy found - user may not have traded yet");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Polymarket discovery failed: ${msg}`);
    }
  }

  // Hyperliquid discovery
  // Hyperliquid uses direct addresses, but we check for sub-accounts/agent wallets
  if (hyperliquid) {
    try {
      const hlProxies = await discoverHyperliquidAddresses(normalizedEoa);
      proxies.push(...hlProxies);
      
      if (hlProxies.length > 1) {
        console.log("[proxy-discovery] ✅ Found additional Hyperliquid addresses (sub-account or agent)");
      }
    } catch (error) {
      // Fallback to simple direct check
      console.warn("[proxy-discovery] Hyperliquid discovery failed, using direct:", error);
      proxies.push(checkHyperliquidDirect(normalizedEoa));
    }
  }

  const result: ProxyDiscoveryResult = {
    eoa: normalizedEoa,
    proxies,
    errors,
    discoveredAt: new Date().toISOString(),
  };

  console.log("[proxy-discovery] Discovery complete:", {
    eoa: normalizedEoa,
    proxiesFound: proxies.length,
    protocols: proxies.map((p) => `${p.protocol}:${p.type}`),
    errors: errors.length,
  });

  return result;
}

/**
 * Get all wallet addresses needed for a specific protocol.
 * Returns both the EOA and any discovered proxy addresses.
 *
 * @param eoa - The user's EOA
 * @param protocol - The protocol to get addresses for
 * @returns Array of addresses to query for positions
 */
export async function getWalletAddressesForProtocol(
  eoa: string,
  protocol: "polymarket" | "hyperliquid"
): Promise<string[]> {
  const result = await discoverProxyWallets(eoa, {
    polymarket: protocol === "polymarket",
    hyperliquid: protocol === "hyperliquid",
  });

  // Return addresses for the specified protocol
  const addresses = result.proxies
    .filter((p) => p.protocol === protocol && p.isDeployed)
    .map((p) => p.address);

  // Always include the EOA as fallback
  const normalizedEoa = getAddress(eoa);
  if (!addresses.includes(normalizedEoa)) {
    addresses.push(normalizedEoa);
  }

  return addresses;
}

/**
 * Quick check if an EOA has any Polymarket proxy wallet deployed.
 */
export async function hasPolymarketProxy(eoa: string): Promise<boolean> {
  const proxy = await queryPolymarketProxyFactory(eoa);
  return proxy !== null && proxy.isDeployed;
}

// =============================================================================
// PROFILE URL EXTRACTION (Fallback Method)
// =============================================================================

/**
 * Extract proxy wallet address from a Polymarket profile URL.
 * This is a fallback method when on-chain discovery fails.
 * 
 * @example
 * // From profile URL: https://polymarket.com/profile/0x1234...
 * const proxy = extractProxyFromProfileUrl("https://polymarket.com/profile/0x1234...");
 * // Returns: "0x1234..."
 */
export function extractProxyFromProfileUrl(url: string): string | null {
  try {
    // Match various Polymarket URL formats
    const patterns = [
      // Standard profile URL
      /polymarket\.com\/profile\/(0x[a-fA-F0-9]{40})/i,
      // Activity URL
      /polymarket\.com\/activity\/(0x[a-fA-F0-9]{40})/i,
      // Any URL with an Ethereum address
      /(0x[a-fA-F0-9]{40})/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) {
        return getAddress(match[1]);
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Try to discover proxy wallet using multiple methods in order of preference.
 * This is a more aggressive discovery that includes slower methods.
 * 
 * Order:
 * 1. Factory contract query (fast)
 * 2. Gnosis Safe event scan (slower, optional)
 * 3. Profile URL extraction (if provided)
 */
export async function discoverPolymarketProxyAggressive(
  eoa: string,
  options: {
    /** Profile URL to extract proxy from (if available) */
    profileUrl?: string;
    /** Whether to scan events (slow) */
    scanEvents?: boolean;
  } = {}
): Promise<DiscoveredProxy | null> {
  const normalizedEoa = getAddress(eoa);

  // Method 1: Factory query
  const factoryResult = await queryPolymarketProxyFactory(normalizedEoa);
  if (factoryResult) {
    return factoryResult;
  }

  // Method 2: Event scan (if enabled)
  if (options.scanEvents) {
    const safeProxies = await scanGnosisSafeProxyEvents(normalizedEoa);
    if (safeProxies.length > 0) {
      return safeProxies[0]; // Return first found
    }
  }

  // Method 3: Profile URL extraction
  if (options.profileUrl) {
    const extracted = extractProxyFromProfileUrl(options.profileUrl);
    if (extracted && extracted.toLowerCase() !== normalizedEoa.toLowerCase()) {
      console.log("[proxy-discovery] Extracted proxy from profile URL:", extracted);
      
      // Verify it's a deployed contract
      const client = getPolygonClient();
      const code = await client.getCode({ address: extracted as Address });
      const isDeployed = code !== undefined && code !== "0x";

      return {
        address: extracted,
        protocol: "polymarket",
        type: "polymarket_proxy",
        ownerEoa: normalizedEoa,
        discoveryMethod: "factory_query", // Mark as factory for consistency
        isDeployed,
      };
    }
  }

  return null;
}

/**
 * Check if the Data API returns positions when queried with an address.
 * This can help verify if an address has Polymarket activity.
 */
export async function verifyPolymarketAddress(address: string): Promise<{
  hasPositions: boolean;
  positionCount: number;
  address: string;
}> {
  try {
    const response = await fetch(
      `https://data-api.polymarket.com/positions?user=${address.toLowerCase()}&sizeThreshold=0`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      return { hasPositions: false, positionCount: 0, address };
    }

    const positions = await response.json();
    return {
      hasPositions: Array.isArray(positions) && positions.length > 0,
      positionCount: Array.isArray(positions) ? positions.length : 0,
      address,
    };
  } catch {
    return { hasPositions: false, positionCount: 0, address };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Polymarket discovery
  queryGnosisSafeFactory,
  queryPolymarketProxyFactory,
  scanGnosisSafeProxyEvents,
  computePotentialSafeAddress,
  POLYMARKET_CONTRACTS,
  // Hyperliquid discovery  
  queryHyperliquidUserRole,
  discoverHyperliquidAddresses,
  checkHyperliquidDirect,
};

