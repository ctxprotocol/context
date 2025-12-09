"use client";

import { useChat } from "@ai-sdk/react";
import { useFundWallet } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { encodeFunctionData, type Hex, parseUnits } from "viem";
import { base } from "viem/chains";
import { useReadContract } from "wagmi";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoPay } from "@/hooks/use-auto-pay";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { useContextSidebar } from "@/hooks/use-context-sidebar";
import { useDebugMode } from "@/hooks/use-debug-mode";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import { useUserSettings } from "@/hooks/use-user-settings";
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { getEstimatedModelCost } from "@/lib/ai/models";
import type { Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { contextRouterAbi } from "@/lib/generated";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import {
  fetcher,
  fetchWithErrorHandlers,
  formatPrice,
  generateUUID,
} from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { AddFundsDialog } from "./tools/add-funds-dialog";
import { ContextSidebar } from "./tools/context-sidebar";
import type { VisibilityType } from "./visibility-selector";

/**
 * Throttle interval for streaming updates (ms)
 * This prevents excessive re-renders during rapid streaming
 * which can freeze CSS animations
 */
const STREAMING_THROTTLE_MS = 150;

/**
 * Auto Mode Tool Selection data from server (two-phase model)
 * Sent after discovery phase when AI has selected tools to use
 * User must approve and pay before execution phase begins
 */
type AutoModeToolSelection = {
  selectedTools: Array<{
    toolId: string;
    name: string;
    description: string;
    price: string;
    developerWallet: string;
    mcpTools?: Array<{ name: string; description?: string }>;
    reason?: string;
  }>;
  totalCost: string;
  selectionReasoning?: string;
  originalQuery?: string;
};

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();
  const {
    setStage,
    setStreamingCode,
    setDebugResult,
    addExecutionLog,
    setStreamingReasoning,
    setReasoningComplete,
  } = usePaymentStatus();
  const { isDebugMode, toggleDebugMode } = useDebugMode();
  const debugModeRef = useRef(isDebugMode);
  const { isAutoMode, recordSpend } = useAutoPay();
  const autoModeRef = useRef(isAutoMode);
  const { client: smartWalletClient } = useSmartWallets();
  const { settings } = useUserSettings();

  // Throttled streaming updates to prevent animation freeze
  // Buffer the latest values and commit at intervals
  const streamingCodeRef = useRef<string | null>(null);
  const streamingReasoningRef = useRef<string | null>(null);
  const lastStreamingUpdateRef = useRef<number>(0);
  const pendingStreamingUpdateRef = useRef<number | null>(null);

  // Throttled setter for streaming code - reduces re-renders during rapid streaming
  const throttledSetStreamingCode = useCallback(
    (code: string | null) => {
      streamingCodeRef.current = code;
      const now = Date.now();
      const timeSinceLastUpdate = now - lastStreamingUpdateRef.current;

      // If enough time has passed, update immediately
      if (timeSinceLastUpdate >= STREAMING_THROTTLE_MS) {
        lastStreamingUpdateRef.current = now;
        setStreamingCode(code);
      } else if (!pendingStreamingUpdateRef.current) {
        // Schedule an update for when throttle period ends
        pendingStreamingUpdateRef.current = window.setTimeout(() => {
          pendingStreamingUpdateRef.current = null;
          lastStreamingUpdateRef.current = Date.now();
          setStreamingCode(streamingCodeRef.current);
          if (streamingReasoningRef.current !== null) {
            setStreamingReasoning(streamingReasoningRef.current);
          }
        }, STREAMING_THROTTLE_MS - timeSinceLastUpdate);
      }
    },
    [setStreamingCode, setStreamingReasoning]
  );

  // Throttled setter for streaming reasoning
  const throttledSetStreamingReasoning = useCallback(
    (reasoning: string | null) => {
      streamingReasoningRef.current = reasoning;
      const now = Date.now();
      const timeSinceLastUpdate = now - lastStreamingUpdateRef.current;

      if (timeSinceLastUpdate >= STREAMING_THROTTLE_MS) {
        lastStreamingUpdateRef.current = now;
        setStreamingReasoning(reasoning);
      }
      // Otherwise it will be batched with the code update
    },
    [setStreamingReasoning]
  );

  // Cleanup pending updates on unmount
  useEffect(() => {
    return () => {
      if (pendingStreamingUpdateRef.current) {
        clearTimeout(pendingStreamingUpdateRef.current);
      }
    };
  }, []);

  // Auto Mode tool selection state (two-phase model)
  const [pendingToolSelection, setPendingToolSelection] =
    useState<AutoModeToolSelection | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Auto Mode AddFundsDialog state (for insufficient balance)
  const [showAutoModeAddFunds, setShowAutoModeAddFunds] = useState(false);
  const [autoModeFundingRequest, setAutoModeFundingRequest] = useState<{
    amount: string;
    toolName: string;
    toolSelection: AutoModeToolSelection;
  } | null>(null);
  const [isAutoModeFunding, setIsAutoModeFunding] = useState(false);
  const { fundWallet } = useFundWallet();
  const { activeWallet, isEmbeddedWallet } = useWalletIdentity();

  // USDC balance check for Auto Mode
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
  const { refetch: refetchAutoModeBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: smartWalletClient?.account?.address
      ? [smartWalletClient.account.address]
      : undefined,
    query: { enabled: false },
  });

  useEffect(() => {
    debugModeRef.current = isDebugMode;
  }, [isDebugMode]);

  useEffect(() => {
    autoModeRef.current = isAutoMode;
  }, [isAutoMode]);

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[chat-client] debug mode state", {
      isDebugMode,
      debugModeRef: debugModeRef.current,
    });
  }

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);
  const {
    isOpen: isContextSidebarOpen,
    toggle: toggleContextSidebar,
    close: closeContextSidebar,
  } = useContextSidebar();

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  // Router address for payment contract
  const routerAddress = process.env
    .NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}`;

  /**
   * Process payment for Auto Mode selected tools (two-phase model)
   * After payment succeeds, returns the payment info needed for execution phase
   */
  const processToolSelectionPayment = useCallback(
    async (
      toolSelection: AutoModeToolSelection
    ): Promise<{
      transactionHash: string;
      selectedTools: Array<{
        toolId: string;
        name: string;
        price: string;
        mcpToolName?: string;
      }>;
      originalQuery?: string;
    } | null> => {
      if (isProcessingPayment || !smartWalletClient) {
        return null;
      }

      setIsProcessingPayment(true);
      console.log(
        "[chat-client] Processing Auto Mode payment (two-phase)",
        toolSelection
      );

      try {
        // Calculate tool fees
        const toolFees = toolSelection.selectedTools.reduce((sum, tool) => {
          return sum + parseUnits(tool.price ?? "0", 6);
        }, 0n);

        // Calculate model cost - convenience tier users pay model costs
        // Auto Mode uses 5x multiplier: discovery + selection + planning + self-healing + execution
        const baseModelCost = getEstimatedModelCost(currentModelIdRef.current);
        const autoModeMultiplier = 5.0; // Matches DEFAULT_MULTIPLIERS.auto_mode in cost-estimation.ts
        const modelCostUSD = baseModelCost * autoModeMultiplier;
        const isConvenienceTier = settings.tier === "convenience";
        const modelCostUnits = isConvenienceTier
          ? parseUnits(modelCostUSD.toFixed(6), 6)
          : 0n;

        // Calculate total for balance check
        const totalAmount = toolFees + modelCostUnits;
        const totalAmountStr = formatPrice(Number(totalAmount) / 1_000_000);
        const toolNames = toolSelection.selectedTools
          .map((t) => t.name)
          .join(", ");

        // Check USDC balance FIRST before attempting transaction
        const { data: balanceData } = await refetchAutoModeBalance();
        const balance = (balanceData as bigint | undefined) ?? 0n;

        if (balance < totalAmount) {
          console.log("[chat-client] Auto Mode: insufficient balance", {
            balance: Number(balance) / 1_000_000,
            needed: Number(totalAmount) / 1_000_000,
            isEmbeddedWallet,
          });

          if (isEmbeddedWallet) {
            // Show AddFundsDialog for embedded wallet users
            setAutoModeFundingRequest({
              amount: totalAmountStr,
              toolName: toolNames,
              toolSelection,
            });
            setShowAutoModeAddFunds(true);
            toast.error("Add funds to continue with Auto Mode.");
          } else {
            toast.error(
              `Insufficient USDC balance. You need ${totalAmountStr} USDC on Base mainnet.`
            );
          }
          setIsProcessingPayment(false);
          return null;
        }

        // Record total spend against budget (tool fees + model cost for convenience tier)
        const toolFeesUSD = Number(toolFees) / 1_000_000;
        const totalSpend = toolFeesUSD + (isConvenienceTier ? modelCostUSD : 0);
        recordSpend(totalSpend);

        console.log("[chat-client] Auto Mode payment breakdown", {
          toolFees: toolFeesUSD,
          modelCost: isConvenienceTier ? modelCostUSD : 0,
          total: totalSpend,
          tier: settings.tier,
        });

        // Encode payment transaction
        let txData: Hex;

        if (toolSelection.selectedTools.length === 1 && isConvenienceTier) {
          // Single tool with model cost - use executeQueryWithModelCost
          const tool = toolSelection.selectedTools[0];
          txData = encodeFunctionData({
            abi: contextRouterAbi,
            functionName: "executeQueryWithModelCost",
            args: [
              0n, // toolId not used
              tool.developerWallet as `0x${string}`,
              parseUnits(tool.price ?? "0", 6), // Tool amount (90/10 split)
              modelCostUnits, // Model cost (100% to platform)
            ],
          });
        } else {
          // Batch payment
          const toolIds = toolSelection.selectedTools.map(() => 0n);
          const developerWallets = toolSelection.selectedTools.map(
            (t) => t.developerWallet as `0x${string}`
          );
          const amounts = toolSelection.selectedTools.map((t) =>
            parseUnits(t.price ?? "0", 6)
          );

          if (isConvenienceTier) {
            // Convenience tier: use executeBatchQueryWithModelCost
            txData = encodeFunctionData({
              abi: contextRouterAbi,
              functionName: "executeBatchQueryWithModelCost",
              args: [toolIds, developerWallets, amounts, modelCostUnits],
            });
          } else {
            // Free/BYOK tier: only tool fees, no model cost
            txData = encodeFunctionData({
              abi: contextRouterAbi,
              functionName: "executeBatchPaidQuery",
              args: [toolIds, developerWallets, amounts],
            });
          }
        }

        console.log("[chat-client] Sending batch payment transaction");

        // Send via smart wallet with auto-signing (no popup in Auto Mode)
        const txHash = await smartWalletClient.sendTransaction(
          {
            chain: base,
            to: routerAddress,
            data: txData,
            value: BigInt(0),
          },
          {
            uiOptions: {
              showWalletUIs: false, // Auto-pay, no confirmation needed
            },
          }
        );

        if (!txHash) {
          throw new Error("No transaction hash returned");
        }

        const hash = txHash as `0x${string}`;
        console.log("[chat-client] Auto Mode payment confirmed", { hash });
        toast.success("Payment confirmed! Executing tools...");

        // Return payment info for execution phase
        return {
          transactionHash: hash,
          selectedTools: toolSelection.selectedTools.map((t) => ({
            toolId: t.toolId,
            name: t.name,
            price: t.price,
            mcpToolName: t.mcpTools?.[0]?.name, // Primary method to call
          })),
          originalQuery: toolSelection.originalQuery,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("[chat-client] Auto Mode payment failed", error);

        // Check for insufficient funds errors from the transaction
        if (
          errorMessage.includes("insufficient") ||
          errorMessage.includes("Insufficient") ||
          errorMessage.includes("exceeds balance")
        ) {
          if (isEmbeddedWallet) {
            const toolNames = toolSelection.selectedTools
              .map((t) => t.name)
              .join(", ");
            setAutoModeFundingRequest({
              amount: toolSelection.totalCost,
              toolName: toolNames,
              toolSelection,
            });
            setShowAutoModeAddFunds(true);
            toast.error("Add funds to continue with Auto Mode.");
          } else {
            toast.error("Insufficient USDC balance.");
          }
        } else if (
          errorMessage.includes("User rejected") ||
          errorMessage.includes("user rejected")
        ) {
          toast.error("Payment cancelled.");
        } else {
          toast.error("Payment failed. Please try again.");
        }
        return null;
      } finally {
        setIsProcessingPayment(false);
      }
    },
    [
      isProcessingPayment,
      smartWalletClient,
      routerAddress,
      recordSpend,
      refetchAutoModeBalance,
      isEmbeddedWallet,
      settings.tier,
    ]
  );

  /**
   * Handle funding wallet for Auto Mode (when insufficient balance)
   */
  const handleAutoModeFundWallet = useCallback(async () => {
    if (!autoModeFundingRequest || !activeWallet?.address) {
      setShowAutoModeAddFunds(false);
      return;
    }

    const parsedAmount = Number.parseFloat(
      autoModeFundingRequest.amount || "0"
    );
    const amountToFund =
      Number.isFinite(parsedAmount) && parsedAmount > 0
        ? parsedAmount.toFixed(2)
        : "1.00";

    // Fund the smart wallet
    const addressToFund =
      smartWalletClient?.account?.address || activeWallet.address;

    try {
      setIsAutoModeFunding(true);
      await fundWallet({
        address: addressToFund,
        options: {
          chain: base,
          asset: "USDC",
          amount: amountToFund,
        },
      });
      await refetchAutoModeBalance();
      toast.success("Funds added! Retrying payment...");
      setShowAutoModeAddFunds(false);

      // Retry the payment with the stored tool selection
      const storedSelection = autoModeFundingRequest.toolSelection;
      setAutoModeFundingRequest(null);

      // Re-trigger payment processing
      if (storedSelection) {
        setPendingToolSelection(storedSelection);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Funding flow cancelled.";
      if (message.toLowerCase().includes("exited")) {
        toast.error("Funding cancelled.");
      } else {
        console.error("fundWallet error:", error);
        toast.error("Failed to open funding flow. Please try again.");
      }
    } finally {
      setIsAutoModeFunding(false);
    }
  }, [
    autoModeFundingRequest,
    activeWallet?.address,
    smartWalletClient,
    fundWallet,
    refetchAutoModeBalance,
  ]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            // Use refs so we always send the latest values,
            // even though the transport closure was created earlier.
            isDebugMode: debugModeRef.current,
            isAutoMode: autoModeRef.current,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      if (process.env.NODE_ENV === "development") {
        // Client-side debug log for streaming parts
        // This helps us verify that tool status, debugCode/debugResult,
        // and assistant text deltas are actually reaching the browser.
        // eslint-disable-next-line no-console
        console.log("[chat-client] data part", {
          type: (dataPart as any).type,
          hasData: "data" in (dataPart as any),
        });
      }
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
      // Handle custom protocol messages
      // Use a switch for cleaner, single-pass handling of each message type
      const part = dataPart as any;
      const partType = part.type as string;

      switch (partType) {
        // Tool status changes - consolidated handler for all stages
        case "data-toolStatus": {
          if (typeof part.data === "object") {
            const statusValue = part.data.status;
            const toolNameFromStatus = part.data.toolName as string | undefined;
            // Single setStage call based on status
            switch (statusValue) {
              case "discovering-tools":
              case "planning":
              case "executing":
              case "thinking":
              case "awaiting-tool-approval":
              case "fixing":
              case "reflecting":
                setStage(statusValue);
                break;
              case "confirming-payment":
                setStage("confirming-payment", toolNameFromStatus ?? undefined);
                break;
              default:
                break;
            }
          }
          break;
        }

        // Stream planning code for real-time display (throttled to prevent animation freeze)
        case "data-debugCode": {
          if (typeof part.data === "string") {
            throttledSetStreamingCode(part.data);
          }
          break;
        }

        // Stream execution result for display
        case "data-debugResult": {
          if (typeof part.data === "string") {
            setDebugResult(part.data);
          }
          break;
        }

        // Stream execution progress (tool queries, results, errors)
        case "data-executionProgress": {
          if (typeof part.data === "object") {
            const { type, toolName, message, timestamp } = part.data as {
              type: "query" | "result" | "error";
              toolName: string;
              message: string;
              timestamp: number;
            };
            addExecutionLog({ type, toolName, message, timestamp });
          }
          break;
        }

        // Stream reasoning/thinking content from models that support it (throttled)
        case "data-reasoning": {
          if (typeof part.data === "string") {
            throttledSetStreamingReasoning(part.data);
          }
          break;
        }

        // Signal that reasoning is complete and code generation is starting
        case "data-reasoningComplete": {
          if (part.data === true) {
            setReasoningComplete(true);
          }
          break;
        }

        // Clear discovery content when no tools found (clean transition to final response)
        case "data-clearDiscovery": {
          if (part.data === true) {
            setStreamingCode(null);
            setStreamingReasoning(null);
            setReasoningComplete(false);
            // Also clear the refs to prevent stale updates
            streamingCodeRef.current = null;
            streamingReasoningRef.current = null;
          }
          break;
        }

        // Auto Mode: Server has selected tools and is awaiting payment approval
        case "data-autoModeToolSelection": {
          if (typeof part.data === "object") {
            console.log(
              "[chat-client] Auto Mode tool selection received",
              part.data
            );
            setPendingToolSelection(part.data as AutoModeToolSelection);
          }
          break;
        }

        default:
          break;
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      // Surface all client-side streaming errors so we can debug issues
      // that aren't ChatSDKError instances (e.g. transport/parse errors).
      // eslint-disable-next-line no-console
      console.error("[chat-client] useChat error", error);

      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while streaming the response."
        );
      }
    },
  });

  /**
   * Process Auto Mode payment and trigger execution phase (two-phase model)
   *
   * Flow:
   * 1. Discovery phase completes, pendingToolSelection is set
   * 2. This effect detects it when status is not streaming
   * 3. Process payment via smart wallet
   * 4. Send NEW message to server with autoModePayment to trigger execution
   * 5. Server verifies payment and executes tools
   * 6. Response streams back with tool results
   */
  useEffect(() => {
    if (
      pendingToolSelection &&
      !isProcessingPayment &&
      status !== "streaming"
    ) {
      const handlePaymentAndExecution = async () => {
        // Show "Confirming payment..."
        setStage("confirming-payment");

        const paymentResult =
          await processToolSelectionPayment(pendingToolSelection);

        if (paymentResult) {
          console.log(
            "[chat-client] Payment confirmed, triggering execution phase"
          );

          // Clear pending selection
          setPendingToolSelection(null);

          // Send a continuation message to trigger execution phase
          // The server will verify payment and execute tools
          // Set "planning" stage before sending - this matches what the server will send
          // The server flow is: planning → executing → thinking
          setStage("planning");

          sendMessage(
            {
              role: "user" as const,
              parts: [{ type: "text", text: "[Continue with execution]" }],
            },
            {
              body: {
                autoModePayment: {
                  transactionHash: paymentResult.transactionHash,
                  selectedTools: paymentResult.selectedTools,
                  originalQuery: paymentResult.originalQuery,
                },
              },
            }
          );
        } else {
          // Payment failed - reset stage
          setPendingToolSelection(null);
          setStage("idle");
        }
      };
      handlePaymentAndExecution();
    }
  }, [
    pendingToolSelection,
    isProcessingPayment,
    status,
    processToolSelectionPayment,
    sendMessage,
    setStage,
  ]);

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      <div className="flex h-dvh min-w-0 flex-col bg-background md:flex-row">
        <div className="overscroll-behavior-contain relative flex min-w-0 flex-1 touch-pan-y flex-col bg-background">
          <ChatHeader
            chatId={id}
            isReadonly={isReadonly}
            onToggleContextSidebar={toggleContextSidebar}
            selectedVisibilityType={initialVisibilityType}
          />

          <Messages
            chatId={id}
            isArtifactVisible={isArtifactVisible}
            isDebugMode={isDebugMode}
            isReadonly={isReadonly}
            messages={messages}
            regenerate={regenerate}
            selectedModelId={initialChatModel}
            setMessages={setMessages}
            status={status}
            votes={votes}
          />

          <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
            <MultimodalInput
              attachments={attachments}
              chatId={id}
              input={input}
              isReadonly={isReadonly}
              messages={messages}
              onModelChange={setCurrentModelId}
              onToggleContextSidebar={toggleContextSidebar}
              selectedModelId={currentModelId}
              selectedVisibilityType={visibilityType}
              sendMessage={sendMessage}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
              usage={usage}
            />
          </div>
        </div>

        <ContextSidebar
          className="md:sticky md:top-0 md:h-dvh"
          isDebugMode={isDebugMode}
          isOpen={isContextSidebarOpen}
          onClose={closeContextSidebar}
          onToggleDebugMode={toggleDebugMode}
        />
      </div>

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />
      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto Mode AddFundsDialog - shown when Auto Mode payment fails due to insufficient balance */}
      <AddFundsDialog
        amountLabel={autoModeFundingRequest?.amount ?? "0.01"}
        isFunding={isAutoModeFunding}
        onDismiss={() => {
          setShowAutoModeAddFunds(false);
          setAutoModeFundingRequest(null);
          setPendingToolSelection(null);
        }}
        onFund={handleAutoModeFundWallet}
        onOpenChange={(open) => {
          setShowAutoModeAddFunds(open);
          if (!open) {
            setAutoModeFundingRequest(null);
            setPendingToolSelection(null);
          }
        }}
        open={Boolean(autoModeFundingRequest) && showAutoModeAddFunds}
        toolName={autoModeFundingRequest?.toolName}
        walletAddress={smartWalletClient?.account?.address}
      />
    </>
  );
}
