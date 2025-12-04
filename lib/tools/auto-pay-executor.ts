import { PrivyClient } from "@privy-io/server-auth";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  type Hex,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

/**
 * Auto Pay Executor
 *
 * Server-side service for executing JIT (Just-In-Time) payments
 * in Auto Mode and via the Public API. Uses the DEPLOYER WALLET (operator)
 * to execute payments on behalf of users via the ContextRouter contract.
 *
 * Flow:
 * 1. User has pre-approved ContextRouter to spend their USDC (Auto Pay setup)
 * 2. Deployer wallet (operator) calls executePaidQueryFor(user, toolId, developer, amount)
 * 3. ContextRouter transfers USDC from user's wallet to developer
 * 4. Deployer wallet pays gas (funded separately)
 *
 * Requirements:
 * - DEPLOYER_KEY: Private key for the deployer/operator wallet
 * - The deployer wallet must be registered as an operator on ContextRouter
 * - User must have approved ContextRouter to spend their USDC
 * - The deployer wallet must be funded with Base ETH for gas fees
 *
 * Usage:
 * - Auto Mode (web): Called automatically during agentic tool execution
 * - Public API: Called by /api/v1/tools/execute for headless API clients
 */

// ContextRouter ABI - using executePaidQueryFor for operator-based execution
const CONTEXT_ROUTER_ABI = [
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "toolId", type: "uint256" },
      { name: "developerWallet", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "executePaidQueryFor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "toolIds", type: "uint256[]" },
      { name: "developerWallets", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    name: "executeBatchPaidQueryFor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Convenience tier: separate tool fees (90/10) from model cost (100% platform)
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "toolId", type: "uint256" },
      { name: "developerWallet", type: "address" },
      { name: "toolAmount", type: "uint256" },
      { name: "modelCost", type: "uint256" },
    ],
    name: "executeQueryWithModelCostFor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Types
export type AutoPayResult = {
  success: boolean;
  transactionHash?: Hex;
  error?: string;
};

export type AutoPayToolPayment = {
  toolId: string;
  developerWallet: string;
  priceUsd: string; // Tool price in USD string (e.g., "0.0001")
  modelCostUsd?: string; // Optional model cost for Convenience tier (100% to platform)
};

// Clients (lazy initialized)
let privyClient: PrivyClient | null = null;
let publicClient: ReturnType<typeof createPublicClient> | null = null;
let walletClient: ReturnType<typeof createWalletClient> | null = null;
let operatorAccount: ReturnType<typeof privateKeyToAccount> | null = null;

function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error(
        "Privy credentials not configured. Set NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET."
      );
    }

    privyClient = new PrivyClient(appId, appSecret);
  }
  return privyClient;
}

function getPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });
  }
  return publicClient;
}

function getOperatorAccount() {
  if (!operatorAccount) {
    // Use DEPLOYER_KEY - the deployer is also the operator for Auto Pay
    const privateKey = process.env.DEPLOYER_KEY;
    if (!privateKey) {
      throw new Error(
        "DEPLOYER_KEY not configured. This is required for Auto Pay operator."
      );
    }
    operatorAccount = privateKeyToAccount(privateKey as `0x${string}`);
  }
  return operatorAccount;
}

function getWalletClient() {
  if (!walletClient) {
    const account = getOperatorAccount();
    walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(),
    });
  }
  return walletClient;
}

function getRouterAddress(): `0x${string}` {
  const address = process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS;
  if (!address) {
    throw new Error("NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS not configured");
  }
  return address as `0x${string}`;
}

/**
 * Convert tool ID (UUID string) to uint256 for contract
 * Uses the first 8 bytes of the UUID as a unique identifier
 */
function toolIdToUint256(toolId: string): bigint {
  // Remove dashes and take first 16 hex chars (8 bytes)
  const hex = toolId.replace(/-/g, "").slice(0, 16);
  return BigInt(`0x${hex}`);
}

/**
 * Convert USD price string to USDC amount (6 decimals)
 */
function usdToUsdcAmount(usdPrice: string): bigint {
  return parseUnits(usdPrice, 6);
}

/**
 * Get user's embedded wallet ADDRESS from their Privy account
 */
async function getUserEmbeddedWalletAddress(
  privyUserId: string
): Promise<`0x${string}` | null> {
  try {
    const privy = getPrivyClient();
    const user = await privy.getUser(privyUserId);

    // Find the embedded wallet
    const embeddedWallet = user.linkedAccounts.find(
      (account) =>
        account.type === "wallet" && account.walletClientType === "privy"
    );

    if (!embeddedWallet || !("address" in embeddedWallet)) {
      console.error("[auto-pay] User has no embedded wallet");
      return null;
    }

    return embeddedWallet.address as `0x${string}`;
  } catch (error) {
    console.error("[auto-pay] Failed to get user embedded wallet:", error);
    return null;
  }
}

/**
 * Execute a single tool payment FOR a user via the operator wallet
 *
 * This uses the server's operator wallet to call executePaidQueryFor,
 * which transfers USDC from the user's wallet (pre-approved) to the developer.
 *
 * @param privyUserId - The user's Privy DID (e.g., "did:privy:...")
 * @param payment - Tool payment details
 * @returns Result with transaction hash or error
 */
export async function executeAutoPayment(
  privyUserId: string,
  payment: AutoPayToolPayment
): Promise<AutoPayResult> {
  try {
    const routerAddress = getRouterAddress();
    const wallet = getWalletClient();
    const client = getPublicClient();

    // Get user's wallet address
    const userAddress = await getUserEmbeddedWalletAddress(privyUserId);
    if (!userAddress) {
      return {
        success: false,
        error: "User has no embedded wallet. Cannot execute Auto Pay.",
      };
    }

    const toolIdUint = toolIdToUint256(payment.toolId);
    const toolAmount = usdToUsdcAmount(payment.priceUsd);
    const modelCost = payment.modelCostUsd
      ? usdToUsdcAmount(payment.modelCostUsd)
      : 0n;
    const hasModelCost = modelCost > 0n;

    console.log("[auto-pay] Executing payment via operator wallet:", {
      operator: wallet.account.address,
      user: userAddress,
      toolId: payment.toolId,
      developer: payment.developerWallet,
      toolAmount: toolAmount.toString(),
      modelCost: modelCost.toString(),
      hasModelCost,
    });

    // Encode the contract call
    // Use executeQueryWithModelCostFor for Convenience tier (has model cost)
    // Use executePaidQueryFor for Free/BYOK tier (no model cost)
    const data = hasModelCost
      ? encodeFunctionData({
          abi: CONTEXT_ROUTER_ABI,
          functionName: "executeQueryWithModelCostFor",
          args: [
            userAddress,
            toolIdUint,
            payment.developerWallet as `0x${string}`,
            toolAmount,
            modelCost,
          ],
        })
      : encodeFunctionData({
          abi: CONTEXT_ROUTER_ABI,
          functionName: "executePaidQueryFor",
          args: [
            userAddress,
            toolIdUint,
            payment.developerWallet as `0x${string}`,
            toolAmount,
          ],
        });

    // Execute from operator wallet
    const hash = await wallet.sendTransaction({
      to: routerAddress,
      data,
      value: 0n,
    });

    console.log("[auto-pay] Payment transaction submitted:", hash);

    // Wait for confirmation
    const receipt = await client.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    if (receipt.status === "success") {
      console.log("[auto-pay] Payment confirmed:", hash);
      return { success: true, transactionHash: hash };
    }

    return {
      success: false,
      error: "Transaction failed",
      transactionHash: hash,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[auto-pay] Payment failed:", errorMessage);

    // Check for common errors
    if (errorMessage.includes("insufficient allowance")) {
      return {
        success: false,
        error:
          "Insufficient allowance. Please increase your Auto Pay spending cap.",
      };
    }
    if (
      errorMessage.includes("insufficient funds") ||
      errorMessage.includes("transfer amount exceeds balance")
    ) {
      return {
        success: false,
        error: "Insufficient USDC balance. Please add funds to your wallet.",
      };
    }
    if (errorMessage.includes("Not an authorized operator")) {
      return {
        success: false,
        error: "Server wallet not registered as operator. Contact support.",
      };
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Execute batch payment for multiple tools from user's wallet via operator
 *
 * @param privyUserId - The user's Privy DID
 * @param payments - Array of tool payments
 * @returns Result with transaction hash or error
 */
export async function executeAutoBatchPayment(
  privyUserId: string,
  payments: AutoPayToolPayment[]
): Promise<AutoPayResult> {
  if (payments.length === 0) {
    return { success: true }; // Nothing to pay
  }

  if (payments.length === 1) {
    return executeAutoPayment(privyUserId, payments[0]);
  }

  try {
    const routerAddress = getRouterAddress();
    const wallet = getWalletClient();
    const client = getPublicClient();

    // Get user's wallet address
    const userAddress = await getUserEmbeddedWalletAddress(privyUserId);
    if (!userAddress) {
      return {
        success: false,
        error: "User has no embedded wallet. Cannot execute Auto Pay.",
      };
    }

    const toolIds = payments.map((p) => toolIdToUint256(p.toolId));
    const developerWallets = payments.map(
      (p) => p.developerWallet as `0x${string}`
    );
    const amounts = payments.map((p) => usdToUsdcAmount(p.priceUsd));

    console.log("[auto-pay] Executing batch payment via operator:", {
      operator: wallet.account.address,
      user: userAddress,
      tools: payments.map((p) => p.toolId),
      totalAmount: amounts.reduce((a, b) => a + b, 0n).toString(),
    });

    // Encode the contract call
    const data = encodeFunctionData({
      abi: CONTEXT_ROUTER_ABI,
      functionName: "executeBatchPaidQueryFor",
      args: [userAddress, toolIds, developerWallets, amounts],
    });

    // Execute from operator wallet
    const hash = await wallet.sendTransaction({
      to: routerAddress,
      data,
      value: 0n,
    });

    console.log("[auto-pay] Batch payment transaction submitted:", hash);

    // Wait for confirmation
    const receipt = await client.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    if (receipt.status === "success") {
      console.log("[auto-pay] Batch payment confirmed:", hash);
      return { success: true, transactionHash: hash };
    }

    return {
      success: false,
      error: "Transaction failed",
      transactionHash: hash,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[auto-pay] Batch payment failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
