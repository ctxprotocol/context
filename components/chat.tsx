"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { encodeFunctionData, parseUnits, type Hex } from "viem";
import { base } from "viem/chains";
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
import { useDebugMode } from "@/hooks/use-debug-mode";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import { contextRouterAbi } from "@/lib/generated";
import type { Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "sonner";
import { useContextSidebar } from "@/hooks/use-context-sidebar";
import { ContextSidebar } from "./tools/context-sidebar";
import type { VisibilityType } from "./visibility-selector";

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

  // Auto Mode tool selection state (two-phase model)
  const [pendingToolSelection, setPendingToolSelection] = useState<AutoModeToolSelection | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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
  const { isOpen: isContextSidebarOpen, toggle: toggleContextSidebar, close: closeContextSidebar } = useContextSidebar();

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  // Router address for payment contract
  const routerAddress = process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}`;

  /**
   * Process payment for Auto Mode selected tools (two-phase model)
   * After payment succeeds, returns the payment info needed for execution phase
   */
  const processToolSelectionPayment = useCallback(async (
    toolSelection: AutoModeToolSelection
  ): Promise<{
    transactionHash: string;
    selectedTools: Array<{ toolId: string; name: string; price: string; mcpToolName?: string }>;
    originalQuery?: string;
  } | null> => {
    if (isProcessingPayment || !smartWalletClient) {
      return null;
    }

    setIsProcessingPayment(true);
    console.log("[chat-client] Processing Auto Mode payment (two-phase)", toolSelection);

    try {
      // Calculate total amount
      const totalAmount = toolSelection.selectedTools.reduce((sum, tool) => {
        return sum + parseUnits(tool.price ?? "0", 6);
      }, 0n);

      // Record spend for budget tracking
      const totalCostUSD = Number(totalAmount) / 1_000_000;
      recordSpend(totalCostUSD);

      // Encode batch payment transaction
      const toolIds = toolSelection.selectedTools.map(() => 0n); // Tool IDs not used in contract
      const developerWallets = toolSelection.selectedTools.map(
        (t) => t.developerWallet as `0x${string}`
      );
      const amounts = toolSelection.selectedTools.map((t) =>
        parseUnits(t.price ?? "0", 6)
      );

      const txData = encodeFunctionData({
        abi: contextRouterAbi,
        functionName: "executeBatchPaidQuery",
        args: [toolIds, developerWallets, amounts],
      });

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
      console.error("[chat-client] Auto Mode payment failed", error);
      toast.error("Payment failed. Please try again.");
      return null;
    } finally {
      setIsProcessingPayment(false);
    }
  }, [isProcessingPayment, smartWalletClient, routerAddress, recordSpend]);

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
      const part = dataPart as any;
      if (part.type === "data-toolStatus" && typeof part.data === "object") {
        const statusValue = part.data.status;
        if (statusValue === "planning") {
          setStage("planning");
        } else if (statusValue === "executing") {
          setStage("executing");
        } else if (statusValue === "thinking") {
          setStage("thinking");
        } else if (statusValue === "confirming-payment") {
          // Auto Mode JIT payment - includes tool name and price
          const toolName = part.data.toolName as string | undefined;
          setStage("confirming-payment", toolName ?? undefined);
        }
      }
      // Stream planning code for real-time display
      if (part.type === "data-debugCode" && typeof part.data === "string") {
        setStreamingCode(part.data);
      }
      // Stream execution result for display
      if (part.type === "data-debugResult" && typeof part.data === "string") {
        setDebugResult(part.data);
      }
      // Stream execution progress (tool queries, results, errors)
      if (part.type === "data-executionProgress" && typeof part.data === "object") {
        const { type, toolName, message, timestamp } = part.data as {
          type: "query" | "result" | "error";
          toolName: string;
          message: string;
          timestamp: number;
        };
        addExecutionLog({ type, toolName, message, timestamp });
      }
      // Stream reasoning/thinking content from models that support it
      if (part.type === "data-reasoning" && typeof part.data === "string") {
        setStreamingReasoning(part.data);
      }
      // Signal that reasoning is complete and code generation is starting
      if (part.type === "data-reasoningComplete" && part.data === true) {
        setReasoningComplete(true);
      }
      // Auto Mode: Server has selected tools and is awaiting payment approval (two-phase model)
      // This is the discovery phase result - tools have been selected but NOT executed yet
      if (part.type === "data-autoModeToolSelection" && typeof part.data === "object") {
        console.log("[chat-client] Auto Mode tool selection received", part.data);
        setPendingToolSelection(part.data as AutoModeToolSelection);
        // Stage will be set by data-toolStatus to "awaiting-tool-approval"
      }
      // Handle the new discovering-tools and awaiting-tool-approval stages
      if (part.type === "data-toolStatus" && typeof part.data === "object") {
        const statusValue = part.data.status;
        if (statusValue === "discovering-tools") {
          setStage("discovering-tools");
        } else if (statusValue === "awaiting-tool-approval") {
          setStage("awaiting-tool-approval");
        }
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
    if (pendingToolSelection && !isProcessingPayment && status !== "streaming") {
      const handlePaymentAndExecution = async () => {
        // Show "Confirming payment..." 
        setStage("confirming-payment");
        
        const paymentResult = await processToolSelectionPayment(pendingToolSelection);
        
        if (paymentResult) {
          console.log("[chat-client] Payment confirmed, triggering execution phase");
          
          // Clear pending selection
          setPendingToolSelection(null);
          
          // Send a continuation message to trigger execution phase
          // The server will verify payment and execute tools
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
          
          // Stage will be updated by the new stream
          setStage("executing");
        } else {
          // Payment failed - reset stage
          setPendingToolSelection(null);
          setStage("idle");
        }
      };
      handlePaymentAndExecution();
    }
  }, [pendingToolSelection, isProcessingPayment, status, processToolSelectionPayment, sendMessage, setStage]);

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
    </>
  );
}
