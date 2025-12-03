"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useFundWallet } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { Trigger } from "@radix-ui/react-select";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { encodeFunctionData, type Hex, parseUnits } from "viem";
import { base } from "viem/chains";
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { SelectItem } from "@/components/ui/select";
import { useAutoPay } from "@/hooks/use-auto-pay";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import type { ToolListItem } from "@/hooks/use-session-tools";
import { useSessionTools } from "@/hooks/use-session-tools";
import { useToolSelection } from "@/hooks/use-tool-selection";
import { useUserSettings } from "@/hooks/use-user-settings";
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import { ERC20_ABI } from "@/lib/abi/erc20";
import {
  chatModels,
  getChatModelsForProvider,
  getEstimatedModelCost,
} from "@/lib/ai/models";
import { myProvider } from "@/lib/ai/providers";
import type { BYOKProvider } from "@/lib/db/schema";
import {
  contextRouterAbi,
  useWriteContextRouterExecuteBatchPaidQuery,
  useWriteContextRouterExecutePaidQuery,
} from "@/lib/generated";

import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn, formatPrice } from "@/lib/utils";
import { Context } from "./elements/context";
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "./elements/prompt-input";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  CpuIcon,
  PaperclipIcon,
  StopIcon,
} from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { SuggestedActions } from "./suggested-actions";
import { AddFundsDialog } from "./tools/add-funds-dialog";
import { type PaymentBreakdown, PaymentDialog } from "./tools/payment-dialog";
import { ToolPicker } from "./tools/tool-picker";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import type { VisibilityType } from "./visibility-selector";

type ToolInvocationPayload = {
  toolId: string;
  transactionHash: `0x${string}`;
  fallbackText?: string;
};

// Batch payment payload for multiple tools
type BatchToolInvocationPayload = {
  toolInvocations: Array<{
    toolId: string;
    transactionHash: `0x${string}`;
  }>;
  fallbackText?: string;
};

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
  usage,
  isReadonly,
  onToggleContextSidebar,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  usage?: AppUsage;
  isReadonly: boolean;
  onToggleContextSidebar?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const { selectedTool, clearTool } = useToolSelection();
  const { activeTools } = useSessionTools();
  // Get user tier to determine if model costs should be included (only for convenience tier)
  const { settings } = useUserSettings();
  const primaryTool: ToolListItem | null =
    selectedTool ?? activeTools[0] ?? null;
  const [executingTool, setExecutingTool] = useState<ToolListItem | null>(null);
  const {
    stage,
    setStage,
    setTransactionInfo,
    reset: resetPaymentStatus,
  } = usePaymentStatus();
  const { activeWallet, isEmbeddedWallet } = useWalletIdentity();
  const { fundWallet } = useFundWallet();
  const { isAutoPay, canAfford, recordSpend, isAutoMode } = useAutoPay();
  const { client: smartWalletClient } = useSmartWallets();

  // Wallet and contract addresses
  // Rename address to wagmiAddress to avoid confusion
  const { address: wagmiAddress, chain } = useAccount();
  const chainId = chain?.id; // Use the actual connected chain, not the configured one
  // Use activeWallet.address as the source of truth for the UI
  const walletAddress = activeWallet?.address as `0x${string}` | undefined;

  // Smart wallet address - this is where USDC should be held for gas-sponsored txs
  const smartWalletAddress = smartWalletClient?.account?.address as
    | `0x${string}`
    | undefined;
  // Use smart wallet for balance/allowance checks when available
  const effectiveWalletAddress = smartWalletAddress || walletAddress;
  const { switchChainAsync } = useSwitchChain();
  const routerAddress =
    (process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}`) ||
    (process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS_SEPOLIA as `0x${string}`);
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  // Only disable input during actual payment stages (setting allowance and confirming payment)
  // Once payment is confirmed, re-enable input even during planning/executing stages
  const isPaymentInProgress =
    stage === "setting-cap" || stage === "confirming-payment";

  // Detect mismatch between Privy active wallet and wagmi account.
  // If this happens while we *think* we're using an embedded wallet,
  // it usually means a browser extension wallet is connected for a
  // different Privy user. In that case, we should not fire on-chain
  // transactions from this session.
  const hasWalletMismatch =
    Boolean(walletAddress) &&
    Boolean(wagmiAddress) &&
    walletAddress?.toLowerCase() !== wagmiAddress?.toLowerCase();

  // USDC balance check - use smart wallet address when available
  const { refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: effectiveWalletAddress ? [effectiveWalletAddress] : undefined,
    query: { enabled: false },
  });

  // USDC allowance (manual refetch before spending) - use smart wallet address
  const { refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: effectiveWalletAddress
      ? [effectiveWalletAddress, routerAddress]
      : undefined,
    query: { enabled: false },
  });
  const { writeContractAsync: writeErc20Async } = useWriteContract();

  // Router execute (single tool)
  const {
    writeContract: writeExecute,
    data: executeHash,
    isPending: isExecutePending,
    error: executeError,
    reset: resetExecute,
  } = useWriteContextRouterExecutePaidQuery();
  const { isLoading: isExecConfirming, isSuccess: isExecSuccess } =
    useWaitForTransactionReceipt({ hash: executeHash });

  // Router execute (batch - multiple tools)
  const {
    writeContract: writeBatchExecute,
    data: batchExecuteHash,
    isPending: isBatchExecutePending,
    error: batchExecuteError,
    reset: resetBatchExecute,
  } = useWriteContextRouterExecuteBatchPaidQuery();
  const { isLoading: isBatchExecConfirming, isSuccess: isBatchExecSuccess } =
    useWaitForTransactionReceipt({ hash: batchExecuteHash });

  const [showPayDialog, setShowPayDialog] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [lastExecutedTx, setLastExecutedTx] = useState<
    `0x${string}` | undefined
  >(undefined);
  // Track which tools are being paid for (for batch payments)
  const [executingTools, setExecutingTools] = useState<ToolListItem[]>([]);
  const [showAddFundsDialog, setShowAddFundsDialog] = useState(false);
  const [isFundingWallet, setIsFundingWallet] = useState(false);
  const [fundingRequest, setFundingRequest] = useState<{
    amount: string;
    toolName: string;
  } | null>(null);

  // Track executeHash to trigger post-payment flow (single or batch)
  useEffect(() => {
    if (executeHash && isPaying) {
      setLastExecutedTx(executeHash);
    }
  }, [executeHash, isPaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track batchExecuteHash for batch payments
  useEffect(() => {
    if (batchExecuteHash && isPaying) {
      setLastExecutedTx(batchExecuteHash);
    }
  }, [batchExecuteHash, isPaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle transaction errors (user cancellation, etc.) - single or batch
  useEffect(() => {
    const error = executeError || batchExecuteError;
    if (error && isPaying) {
      const errorMessage = error.message || "Transaction failed";

      // Remove any temp payment messages
      setMessages((prev) =>
        prev.filter((msg) => !msg.id.startsWith("temp-payment"))
      );

      // Check if user rejected the transaction
      if (
        errorMessage.includes("User rejected") ||
        errorMessage.includes("user rejected")
      ) {
        // Expected user action – don't treat as hard error
        toast.error("Transaction cancelled");
      } else {
        toast.error("Payment failed. Please try again.");
      }

      // Reset state
      setIsPaying(false);
      setShowPayDialog(false);
      resetExecute();
      resetBatchExecute();
      resetPaymentStatus();
      setLastExecutedTx(undefined);
      setExecutingTool(null);
      setExecutingTools([]);
    }
  }, [
    executeError,
    batchExecuteError,
    isPaying,
    resetExecute,
    resetBatchExecute,
    setMessages,
    resetPaymentStatus,
  ]);

  // Clear executed tx on successful submit or error to prevent reuse
  useEffect(() => {
    // This effect ensures we don't hold onto a used TX hash if the submission fails at the chat level
    // or if the user navigates away.
    if (status === "submitted" || status === "streaming") {
      setLastExecutedTx(undefined);
      setExecutingTool(null);
      setExecutingTools([]);
    }
  }, [status]);

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustHeight, localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  useEffect(() => {
    if (isReadonly) {
      setInput("");
    }
  }, [isReadonly, setInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  // Track if we should auto-execute payment (when Auto Pay is enabled)
  const [pendingAutoPayment, setPendingAutoPayment] = useState(false);

  const submitForm = useCallback(
    (toolInvocation?: ToolInvocationPayload | BatchToolInvocationPayload) => {
      const trimmedInput = input.trim();
      const hasText = trimmedInput.length > 0;

      // In Auto Mode, ignore manually selected tools - let auto mode discover tools itself
      if (
        !toolInvocation &&
        !isReadonly &&
        !isAutoMode &&
        (selectedTool || activeTools.length > 0)
      ) {
        // Calculate total cost - tool fees + model cost (only for convenience tier)
        const toolsToPay = selectedTool ? [selectedTool] : activeTools;
        const paidTools = toolsToPay.filter(
          (t) => Number(t.pricePerQuery ?? 0) > 0
        );
        const toolCost = paidTools.reduce(
          (sum, t) => sum + Number(t.pricePerQuery ?? 0),
          0
        );
        // Model cost only applies to convenience tier - free/BYOK users don't pay model costs
        // Apply flow multiplier heuristic: manual_tools = 3x (planning + self-healing + final)
        // Note: These match the backend DEFAULT_MULTIPLIERS in cost-estimation.ts
        const baseCost = getEstimatedModelCost(selectedModelId);
        const hasTools = toolsToPay.length > 0;
        const flowMultiplier = hasTools ? 3.0 : 1.0; // manual_tools vs manual_simple
        const modelCost =
          settings.tier === "convenience" ? baseCost * flowMultiplier : 0;
        const totalCost = toolCost + modelCost;

        // If there are paid tools, handle payment (model cost alone doesn't require payment for non-convenience tiers)
        const needsPayment = paidTools.length > 0;

        if (needsPayment) {
          // If Auto Pay is enabled and within budget, trigger auto-payment
          if (isAutoPay && canAfford(totalCost)) {
            // Set flag to trigger auto-payment via useEffect
            setPendingAutoPayment(true);
            return;
          }

          if (isAutoPay && !canAfford(totalCost)) {
            // Budget exceeded - show toast and fall back to dialog
            toast.error(
              `Budget exceeded. Need $${totalCost.toFixed(4)} but only have remaining budget.`
            );
          }

          // Show payment dialog (normal flow or Auto Pay budget exceeded)
          setShowPayDialog(true);
          return;
        }
        // Free tools with free model - no payment needed, fall through
      }

      window.history.pushState({}, "", `/chat/${chatId}`);

      const textValue = hasText ? input : (toolInvocation?.fallbackText ?? "");

      if (!textValue && attachments.length === 0) {
        return;
      }

      const messagePayload = {
        role: "user" as const,
        parts: [
          ...attachments.map((attachment) => ({
            type: "file" as const,
            url: attachment.url,
            name: attachment.name,
            mediaType: attachment.contentType,
          })),
          {
            type: "text" as const,
            text: textValue,
          },
        ],
      };

      // Handle both single and batch tool invocations
      // In Auto Mode, don't send toolInvocations - let auto mode discover tools itself
      let sendOptions:
        | {
            body: {
              toolInvocations: {
                toolId: string;
                transactionHash: `0x${string}`;
              }[];
            };
          }
        | undefined;
      if (toolInvocation && !isAutoMode) {
        if ("toolInvocations" in toolInvocation) {
          // Batch invocation
          sendOptions = {
            body: {
              toolInvocations: toolInvocation.toolInvocations,
            },
          };
        } else {
          // Single invocation
          sendOptions = {
            body: {
              toolInvocations: [toolInvocation],
            },
          };
        }
      }

      sendMessage(messagePayload, sendOptions);

      setAttachments([]);
      setLocalStorageInput("");
      resetHeight();
      setInput("");

      if (width && width > 768) {
        textareaRef.current?.focus();
      }
    },
    [
      input,
      attachments,
      sendMessage,
      setAttachments,
      setLocalStorageInput,
      resetHeight,
      setInput,
      width,
      chatId,
      isReadonly,
      selectedTool,
      activeTools,
      isAutoPay,
      canAfford,
      selectedModelId,
      isAutoMode,
      settings.tier, // Needed to determine if model cost applies (convenience tier only)
    ]
  );

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (_error) {
      toast.error("Failed to upload file, please try again!");
    }
  }, []);

  const _modelResolver = useMemo(() => {
    return myProvider.languageModel(selectedModelId);
  }, [selectedModelId]);

  const contextProps = useMemo(
    () => ({
      usage,
    }),
    [usage]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );

      if (imageItems.length === 0) {
        return;
      }

      // Prevent default paste behavior for images
      event.preventDefault();

      setUploadQueue((prev) => [...prev, "Pasted image"]);

      try {
        const uploadPromises = imageItems.map((item) => {
          const file = item.getAsFile();
          if (!file) {
            return Promise.resolve(null);
          }
          return uploadFile(file);
        });

        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment): attachment is Attachment =>
            attachment !== null && attachment !== undefined
        );

        setAttachments((curr) => [
          ...curr,
          ...(successfullyUploadedAttachments as Attachment[]),
        ]);
      } catch {
        toast.error("Failed to upload pasted image(s)");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  // Add paste event listener to textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  // Helper to clean up payment state after transaction
  const cleanupPaymentState = useCallback(() => {
    setIsPaying(false);
    setShowPayDialog(false);
    setLastExecutedTx(undefined);
    setExecutingTool(null);
    setExecutingTools([]);
    resetExecute();
    resetBatchExecute();
  }, [resetExecute, resetBatchExecute]);

  const handleSwitchNetwork = useCallback(async () => {
    try {
      setIsSwitchingNetwork(true);
      await switchChainAsync({ chainId: base.id });
      toast.success("Successfully switched to Base");
      // Give Wagmi/Privy a moment to propagate the new chain to useAccount()
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Network switch failed:", error);
      toast.error("Failed to switch network. Please try again.");
    } finally {
      setIsSwitchingNetwork(false);
    }
  }, [switchChainAsync]);

  const handleFundWallet = useCallback(async () => {
    if (!fundingRequest) {
      setShowAddFundsDialog(false);
      return;
    }

    if (!activeWallet?.address) {
      toast.error("Embedded wallet not ready. Please try again.");
      return;
    }

    const parsedAmount = Number.parseFloat(fundingRequest.amount || "0");
    const amountToFund =
      Number.isFinite(parsedAmount) && parsedAmount > 0
        ? parsedAmount.toFixed(2)
        : "1.00";

    // Fund the smart wallet (not the EOA) so funds are available for gas-sponsored txs
    const addressToFund = smartWalletAddress || activeWallet.address;

    try {
      setIsFundingWallet(true);
      await fundWallet({
        address: addressToFund,
        options: {
          chain: base,
          asset: "USDC",
          amount: amountToFund,
        },
      });
      await refetchBalance();
      toast.success(
        "Funds added to your smart wallet. You can try the tool again."
      );
      setShowAddFundsDialog(false);
      setFundingRequest(null);

      // If Auto Pay is enabled and can afford, trigger auto-payment
      // Otherwise show the payment dialog
      if (isAutoPay && canAfford(Number(fundingRequest.amount))) {
        setPendingAutoPayment(true);
      } else {
        setShowPayDialog(true);
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
      setIsFundingWallet(false);
    }
  }, [
    activeWallet?.address,
    smartWalletAddress,
    fundWallet,
    fundingRequest,
    refetchBalance,
    isAutoPay,
    canAfford,
  ]);

  useEffect(() => {
    if (status === "ready") {
      resetPaymentStatus();
    }
  }, [status, resetPaymentStatus]);

  const confirmPayment = useCallback(async () => {
    // Determine which tools to pay for
    const toolsToPay = selectedTool ? [selectedTool] : activeTools;

    // Use smart wallet address for checks (same as balance/allowance)
    if (
      toolsToPay.length === 0 ||
      !effectiveWalletAddress ||
      !routerAddress ||
      !usdcAddress
    ) {
      toast.error("Missing wallet or contract configuration.");
      return;
    }

    // Double-check network (shouldn't happen with UI guard, but safety first)
    if (chainId !== base.id) {
      toast.error("Please switch to Base mainnet first.");
      return;
    }

    // Calculate tool fees (outside try so it's accessible in catch)
    let toolFees = 0n;
    for (const tool of toolsToPay) {
      toolFees += parseUnits(tool.pricePerQuery ?? "0.00", 6);
    }

    // Model cost only applies to convenience tier - free/BYOK users don't pay model costs upfront
    // (BYOK users pay directly to their provider, free tier model costs are absorbed by platform)
    // Apply flow multiplier: manual_tools = 3x (planning + self-healing + final response)
    const baseCostUSD = getEstimatedModelCost(selectedModelId);
    const hasToolsForPayment = toolsToPay.length > 0;
    const paymentFlowMultiplier = hasToolsForPayment ? 3.0 : 1.0;
    const modelCostUSD =
      settings.tier === "convenience" ? baseCostUSD * paymentFlowMultiplier : 0;
    const modelCostUnits = parseUnits(modelCostUSD.toFixed(6), 6);

    // Total amount = tool fees + model cost (model cost only for convenience tier)
    const totalAmount = toolFees + modelCostUnits;
    const totalAmountStr = formatPrice(Number(totalAmount) / 1_000_000);
    const toolNames = toolsToPay.map((t) => t.name).join(", ");

    try {
      setIsPaying(true);

      // Calculate max allowance for all tools combined
      let maxAllowance = 0n;
      for (const tool of toolsToPay) {
        const pricePerQuery = Number.parseFloat(tool.pricePerQuery ?? "0.01");
        maxAllowance += parseUnits((pricePerQuery * 1000).toString(), 6);
      }
      // Add model cost buffer to allowance
      maxAllowance += parseUnits((modelCostUSD * 1000).toFixed(6), 6);

      // Check USDC balance first
      const { data: balanceData } = await refetchBalance();
      const balance = (balanceData as bigint | undefined) ?? 0n;

      if (balance < totalAmount) {
        if (isEmbeddedWallet) {
          setFundingRequest({
            amount: totalAmountStr,
            toolName: toolNames,
          });
          toast.error("You need to add USDC before running these tools.");
          setShowAddFundsDialog(true);
        } else {
          toast.error(
            `Insufficient USDC balance. You need ${totalAmountStr} USDC on Base mainnet.`
          );
        }
        setIsPaying(false);
        setShowPayDialog(false);
        resetPaymentStatus();
        return;
      }

      // Check for wallet mismatch
      if (isEmbeddedWallet && hasWalletMismatch) {
        toast.error(
          "You're logged in with an embedded wallet, but a different browser wallet is connected. To use this account, disconnect external wallets or log in directly with that wallet."
        );
        setIsPaying(false);
        setShowPayDialog(false);
        resetPaymentStatus();
        return;
      }

      // AUTO PAY PATH: Use smart wallet with auto-signing (no popups!)
      if (isAutoPay && smartWalletClient) {
        setStage("confirming-payment", toolNames);

        // Record the spend in our budget tracker
        const totalCostUSD = Number(totalAmount) / 1_000_000;
        recordSpend(totalCostUSD);

        // Encode the contract call
        // For convenience tier with model cost, use executeQueryWithModelCost
        // which sends tool fees to developer (90/10) and model cost 100% to platform
        let txData: Hex;
        const hasModelCost =
          settings.tier === "convenience" && modelCostUnits > 0n;

        if (toolsToPay.length === 1) {
          const tool = toolsToPay[0];
          setExecutingTool(tool);

          if (hasModelCost) {
            // Convenience tier: separate tool fees and model cost
            txData = encodeFunctionData({
              abi: contextRouterAbi,
              functionName: "executeQueryWithModelCost",
              args: [
                0n,
                tool.developerWallet as `0x${string}`,
                toolFees, // Tool amount (90/10 split)
                modelCostUnits, // Model cost (100% to platform)
              ],
            });
          } else {
            // Free/BYOK tier: only tool fees, no model cost
            txData = encodeFunctionData({
              abi: contextRouterAbi,
              functionName: "executePaidQuery",
              args: [0n, tool.developerWallet as `0x${string}`, toolFees],
            });
          }
        } else {
          setExecutingTools(toolsToPay);
          const toolIds = toolsToPay.map(() => 0n);
          const developerWallets = toolsToPay.map(
            (t) => t.developerWallet as `0x${string}`
          );
          const amounts = toolsToPay.map((t) =>
            parseUnits(t.pricePerQuery ?? "0.00", 6)
          );

          if (hasModelCost) {
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

        // Send via smart wallet with AUTO-SIGNING
        // Pass showWalletUIs: false to skip the confirmation popup
        // This enables TRUE Auto Pay - no confirmation needed!
        setTransactionInfo({ status: "pending", hash: null });

        const txHash = await smartWalletClient.sendTransaction(
          {
            chain: base,
            to: routerAddress,
            data: txData,
            value: BigInt(0),
          },
          {
            // Disable Privy's confirmation modal for auto-pay
            // Security is handled by the ERC-20 spending cap approval
            uiOptions: {
              showWalletUIs: false,
            },
          }
        );

        if (!txHash) {
          setTransactionInfo({ status: "failed", error: "No hash returned" });
          toast.error("Transaction failed - no hash returned");
          cleanupPaymentState();
          return;
        }

        const hash = txHash as `0x${string}`;
        setTransactionInfo({ status: "submitted", hash });
        setLastExecutedTx(hash);

        // Mark as confirmed (Privy waits for confirmation before returning)
        setTransactionInfo({ status: "confirmed" });
        toast.success("Payment processed automatically!");

        // Submit the form with the transaction hash (use outer toolNames)
        if (toolsToPay.length > 1) {
          setStage("planning", toolNames);
          submitForm({
            toolInvocations: toolsToPay.map((tool) => ({
              toolId: tool.id,
              transactionHash: hash,
            })),
            fallbackText: `Using ${toolNames}`,
          });
        } else if (toolsToPay.length === 1) {
          const tool = toolsToPay[0];
          setStage("planning", tool.name);
          submitForm({
            toolId: tool.id,
            transactionHash: hash,
            fallbackText: `Using ${tool.name}`,
          });
        }

        cleanupPaymentState();
        return;
      }

      // MANUAL PATH: Use smart wallet WITH confirmation popup
      // This ensures gas sponsorship while still requiring user approval
      if (!smartWalletClient) {
        toast.error("Smart wallet not available. Please try again.");
        setIsPaying(false);
        setShowPayDialog(false);
        return;
      }

      // Check and handle allowance (using smart wallet for gas sponsorship)
      const allowanceRes = await refetchAllowance();
      const allowance = (allowanceRes.data as bigint | undefined) ?? 0n;
      if (allowance < totalAmount) {
        setStage("setting-cap", toolNames);

        // Encode approve call
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [routerAddress, maxAllowance],
        });

        // Use smart wallet for approval (gas sponsored, with popup)
        await smartWalletClient.sendTransaction(
          {
            chain: base,
            to: usdcAddress,
            data: approveData,
            value: BigInt(0),
          },
          {
            // Show confirmation popup for manual payments
            uiOptions: {
              showWalletUIs: true,
            },
          }
        );

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      setStage("confirming-payment", toolNames);

      // Record the spend in our budget tracker (Manual payments also track against budget)
      const totalCostUSD = Number(totalAmount) / 1_000_000;
      recordSpend(totalCostUSD);

      // Encode the payment transaction
      // For convenience tier with model cost, use executeQueryWithModelCost
      let txData: Hex;
      const hasModelCost =
        settings.tier === "convenience" && modelCostUnits > 0n;

      if (toolsToPay.length === 1) {
        const tool = toolsToPay[0];
        setExecutingTool(tool);

        if (hasModelCost) {
          // Convenience tier: separate tool fees and model cost
          txData = encodeFunctionData({
            abi: contextRouterAbi,
            functionName: "executeQueryWithModelCost",
            args: [
              0n,
              tool.developerWallet as `0x${string}`,
              toolFees, // Tool amount (90/10 split)
              modelCostUnits, // Model cost (100% to platform)
            ],
          });
        } else {
          // Free/BYOK tier: only tool fees
          txData = encodeFunctionData({
            abi: contextRouterAbi,
            functionName: "executePaidQuery",
            args: [0n, tool.developerWallet as `0x${string}`, toolFees],
          });
        }
      } else {
        setExecutingTools(toolsToPay);
        const toolIds = toolsToPay.map(() => 0n);
        const developerWallets = toolsToPay.map(
          (t) => t.developerWallet as `0x${string}`
        );
        const amounts = toolsToPay.map((t) =>
          parseUnits(t.pricePerQuery ?? "0.00", 6)
        );

        if (hasModelCost) {
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

      // Send via smart wallet WITH confirmation popup (gas sponsored!)
      setTransactionInfo({ status: "pending", hash: null });

      const txHash = await smartWalletClient.sendTransaction(
        {
          chain: base,
          to: routerAddress,
          data: txData,
          value: BigInt(0),
        },
        {
          // Show confirmation popup for manual payments
          uiOptions: {
            showWalletUIs: true,
          },
        }
      );

      if (txHash) {
        const hash = txHash as `0x${string}`;
        setTransactionInfo({ status: "submitted", hash });
        setLastExecutedTx(hash);

        // Mark as confirmed (Privy waits for confirmation before returning)
        setTransactionInfo({ status: "confirmed" });
        toast.success("Payment confirmed!");

        // Submit the form with the transaction hash (use outer toolNames)
        if (toolsToPay.length > 1) {
          setStage("planning", toolNames);
          submitForm({
            toolInvocations: toolsToPay.map((tool) => ({
              toolId: tool.id,
              transactionHash: hash,
            })),
            fallbackText: `Using ${toolNames}`,
          });
        } else if (toolsToPay.length === 1) {
          const singleTool = toolsToPay[0];
          setStage("planning", singleTool.name);
          submitForm({
            toolId: singleTool.id,
            transactionHash: hash,
            fallbackText: `Using ${singleTool.name}`,
          });
        }
      }

      cleanupPaymentState();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Set transaction as failed with the error message
      setTransactionInfo({ status: "failed", error: errorMessage });

      if (
        errorMessage.includes("User rejected") ||
        errorMessage.includes("user rejected") ||
        errorMessage.includes("User denied")
      ) {
        toast.error("Transaction cancelled");
      } else if (
        errorMessage.includes("insufficient funds") ||
        errorMessage.includes("Insufficient")
      ) {
        // Use outer toolNames already computed
        if (isEmbeddedWallet) {
          setFundingRequest({
            amount: formatPrice(Number(totalAmount) / 1_000_000),
            toolName: toolNames,
          });
          setShowAddFundsDialog(true);
          toast.error("You need to add USDC before running these tools.");
        } else {
          toast.error("Insufficient USDC balance");
        }
      } else {
        console.error("Payment error:", error);
        toast.error("Payment failed. Please try again.");
      }

      setIsPaying(false);
      setShowPayDialog(false);
      resetPaymentStatus();
    }
  }, [
    selectedTool,
    activeTools,
    effectiveWalletAddress,
    chainId,
    routerAddress,
    usdcAddress,
    refetchBalance,
    isEmbeddedWallet,
    hasWalletMismatch,
    refetchAllowance,
    setStage,
    setTransactionInfo,
    resetPaymentStatus,
    isAutoPay,
    smartWalletClient,
    recordSpend,
    cleanupPaymentState,
    submitForm,
    selectedModelId,
    settings.tier, // Needed to determine if model cost applies (convenience tier only)
  ]);

  // Auto-execute payment when Auto Pay is enabled and triggered
  useEffect(() => {
    if (pendingAutoPayment && !isPaying) {
      setPendingAutoPayment(false);
      confirmPayment();
    }
  }, [pendingAutoPayment, isPaying, confirmPayment]);

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 &&
        !isReadonly &&
        !isPaymentInProgress && (
          <SuggestedActions
            chatId={chatId}
            isReadonly={isReadonly}
            selectedVisibilityType={selectedVisibilityType}
            sendMessage={sendMessage}
          />
        )}

      <input
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <PromptInput
        className="rounded-xl border border-border bg-background p-3 shadow-xs transition-all duration-200 focus-within:border-border hover:border-muted-foreground/50"
        data-wallet-type={isEmbeddedWallet ? "embedded" : "external"}
        onSubmit={(event) => {
          event.preventDefault();
          if (status !== "ready") {
            toast.error("Please wait for the model to finish its response!");
          } else {
            submitForm();
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0 || selectedTool) && (
          <div
            className="flex flex-row items-end gap-2 overflow-x-scroll"
            data-testid="attachments-preview"
          >
            {selectedTool && (
              <Badge
                className="flex items-center gap-1 px-2 py-1"
                variant="secondary"
              >
                <span className="text-xs">{selectedTool.name}</span>
                <button
                  className="ml-1 hover:text-foreground"
                  onClick={clearTool}
                  type="button"
                >
                  ×
                </button>
              </Badge>
            )}
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                key={attachment.url}
                onRemove={() => {
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter((a) => a.url !== attachment.url)
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  url: "",
                  name: filename,
                  contentType: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}
        <div className="flex flex-row items-start gap-1 sm:gap-2">
          <PromptInputTextarea
            autoFocus={!isReadonly && !isPaymentInProgress}
            className={cn(
              "grow resize-none border-0! border-none! bg-transparent p-2 text-sm outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden",
              (isReadonly || isPaymentInProgress) &&
                "cursor-not-allowed opacity-50"
            )}
            data-testid="multimodal-input"
            disableAutoResize={true}
            disabled={isReadonly || isPaymentInProgress}
            maxHeight={200}
            minHeight={44}
            onChange={handleInput}
            placeholder={
              isReadonly
                ? "Connect your wallet to start chatting..."
                : "Send a message..."
            }
            ref={textareaRef}
            rows={1}
            value={input}
          />{" "}
          <Context {...contextProps} />
        </div>

        <PromptInputToolbar className="!border-top-0 border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
          <PromptInputTools
            className={cn(
              "gap-0 transition-opacity sm:gap-0.5",
              isPaymentInProgress && "pointer-events-none opacity-50"
            )}
          >
            <AttachmentsButton
              fileInputRef={fileInputRef}
              isReadonly={isReadonly || isPaymentInProgress}
              selectedModelId={selectedModelId}
              status={status}
            />
            <ModelSelectorCompact
              isReadonly={isReadonly || isPaymentInProgress}
              onModelChange={onModelChange}
              selectedModelId={selectedModelId}
            />
            <ToolPicker
              isReadonly={isReadonly || isPaymentInProgress}
              onToggleContextSidebar={onToggleContextSidebar}
              selectedTool={selectedTool}
            />
          </PromptInputTools>

          {(() => {
            // Show stop button during active AI processing stages (planning, executing, etc.)
            // This allows users to cancel at any time from Planning until the end
            const isActiveProcessingStage =
              stage === "planning" ||
              stage === "executing" ||
              stage === "thinking" ||
              stage === "querying-tool";
            const showStopButton =
              status === "submitted" ||
              status === "streaming" ||
              isActiveProcessingStage;

            return showStopButton ? (
              <StopButton setMessages={setMessages} stop={stop} />
            ) : (
              <PromptInputSubmit
                className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
                data-testid="send-button"
                disabled={
                  isReadonly ||
                  isPaymentInProgress ||
                  !input.trim() ||
                  uploadQueue.length > 0
                }
                status={status}
              >
                <ArrowUpIcon size={14} />
              </PromptInputSubmit>
            );
          })()}
        </PromptInputToolbar>
      </PromptInput>
      {selectedTool || activeTools.length > 0
        ? (() => {
            // Calculate cost breakdown for payment dialog
            const toolsToPay = selectedTool ? [selectedTool] : activeTools;
            const toolCost = toolsToPay.reduce(
              (sum, t) => sum + Number(t.pricePerQuery ?? 0),
              0
            );
            // Model cost only shown for convenience tier users
            // Apply flow multiplier: manual_tools = 3x (planning + self-healing + final)
            const baseModelCost = getEstimatedModelCost(selectedModelId);
            const dialogFlowMultiplier = toolsToPay.length > 0 ? 3.0 : 1.0;
            const modelCost =
              settings.tier === "convenience"
                ? baseModelCost * dialogFlowMultiplier
                : 0;
            const totalCost = toolCost + modelCost;
            const breakdown: PaymentBreakdown = {
              toolCost,
              modelCost,
              totalCost,
            };

            return (
              <PaymentDialog
                breakdown={breakdown}
                chainId={chainId}
                isBusy={
                  isPaying ||
                  isExecutePending ||
                  isExecConfirming ||
                  isBatchExecutePending ||
                  isBatchExecConfirming
                }
                isSwitchingNetwork={isSwitchingNetwork}
                onConfirm={confirmPayment}
                onOpenChange={setShowPayDialog}
                onSwitchNetwork={handleSwitchNetwork}
                open={showPayDialog}
                price={totalCost.toFixed(6)}
                toolName={
                  selectedTool
                    ? selectedTool.name
                    : activeTools.length === 1
                      ? activeTools[0].name
                      : `${activeTools.length} tools`
                }
              />
            );
          })()
        : null}
      <AddFundsDialog
        amountLabel={
          fundingRequest?.amount ?? primaryTool?.pricePerQuery ?? "0.01"
        }
        isFunding={isFundingWallet}
        onDismiss={() => {
          setShowAddFundsDialog(false);
          setFundingRequest(null);
        }}
        onFund={handleFundWallet}
        onOpenChange={(open) => {
          setShowAddFundsDialog(open);
          if (!open) {
            setFundingRequest(null);
          }
        }}
        open={Boolean(fundingRequest) && showAddFundsDialog}
        toolName={fundingRequest?.toolName ?? primaryTool?.name}
        walletAddress={effectiveWalletAddress}
      />
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }

    return true;
  }
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
  isReadonly,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  selectedModelId: string;
  isReadonly: boolean;
}) {
  const isReasoningModel = selectedModelId === "chat-model-reasoning";

  return (
    <Button
      className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
      data-testid="attachments-button"
      disabled={status !== "ready" || isReasoningModel || isReadonly}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ width: 14, height: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
  isReadonly,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  isReadonly: boolean;
}) {
  const [optimisticModelId, setOptimisticModelId] = useState(selectedModelId);
  const { settings } = useUserSettings();

  useEffect(() => {
    setOptimisticModelId(selectedModelId);
  }, [selectedModelId]);

  // Get models based on BYOK provider
  const byokProvider: BYOKProvider | null =
    settings.tier === "byok" && settings.byokProvider
      ? (settings.byokProvider as BYOKProvider)
      : null;

  const availableModels = getChatModelsForProvider(byokProvider);

  const selectedModel = availableModels.find(
    (model) => model.id === optimisticModelId
  );

  return (
    <PromptInputModelSelect
      onValueChange={(modelName) => {
        if (isReadonly) {
          return;
        }
        const model = availableModels.find((m) => m.name === modelName);
        if (model) {
          setOptimisticModelId(model.id);
          onModelChange?.(model.id);
          startTransition(() => {
            saveChatModelAsCookie(model.id);
          });
        }
      }}
      value={selectedModel?.name}
    >
      <Trigger asChild>
        <Button className="h-8 px-2" disabled={isReadonly} variant="ghost">
          <CpuIcon size={16} />
          <span className="hidden font-medium text-xs sm:block">
            {selectedModel?.name}
          </span>
          <ChevronDownIcon size={16} />
        </Button>
      </Trigger>
      <PromptInputModelSelectContent className="min-w-[260px] p-0">
        <div className="flex flex-col gap-px">
          {availableModels.map((model) => (
            <SelectItem key={model.id} value={model.name}>
              <div className="truncate font-medium text-xs">{model.name}</div>
              <div className="mt-px truncate text-[10px] text-muted-foreground leading-tight">
                {model.description}
              </div>
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Button
      className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
      data-testid="stop-button"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
