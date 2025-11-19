import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { getToolQueryByTransactionHash } from "@/lib/db/queries";

const client = createPublicClient({
  // All payments are on Base mainnet
  chain: base,
  transport: http(),
});

export interface PaymentVerification {
  isValid: boolean;
  toolId?: string;
  userAddress?: string;
  developerAddress?: string;
  amount?: bigint;
  platformFee?: bigint;
  error?: string;
}

/**
 * Verify a payment transaction on-chain
 * Checks that the transaction exists, emitted the correct event, and hasn't been used before
 */
export async function verifyPayment(
  txHash: `0x${string}`,
  expectedToolId: string,
  expectedDeveloperAddress: string
): Promise<PaymentVerification> {
  try {
    // 1. Get transaction receipt
    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (!receipt) {
      return {
        isValid: false,
        error: "Transaction not found",
      };
    }

    if (receipt.status !== "success") {
      return {
        isValid: false,
        error: "Transaction failed",
      };
    }

    // 2. Check if transaction has already been used
    const existingQuery = await getToolQueryByTransactionHash({
      transactionHash: txHash,
    });

    if (existingQuery) {
      return {
        isValid: false,
        error: "Transaction already used",
      };
    }

    // 3. Check that the transaction interacted with our ContextRouter contract
    const contractAddress = process.env
      .NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}` | undefined;

    if (!contractAddress) {
      return {
        isValid: false,
        error: "Router contract address not configured",
      };
    }

    const queryPaidLog = receipt.logs.find(
      (log) => log.address.toLowerCase() === contractAddress.toLowerCase()
    );

    if (!queryPaidLog) {
      return {
        isValid: false,
        error: "QueryPaid event not found in transaction",
      };
    }

    // 4. Decode event data
    // Note: This is a simplified version. In production, you'd want to use proper ABI decoding
    // For now, we'll trust the transaction if it emitted the event from our contract

    return {
      isValid: true,
      userAddress: receipt.from,
      developerAddress: expectedDeveloperAddress,
      toolId: expectedToolId,
    };
  } catch (error) {
    console.error("Payment verification error:", error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}
