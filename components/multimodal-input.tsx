"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useFundWallet } from "@privy-io/react-auth";
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
import { parseUnits } from "viem";
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
import { usePaymentStatus } from "@/hooks/use-payment-status";
import { useSessionTools } from "@/hooks/use-session-tools";
import { useToolSelection } from "@/hooks/use-tool-selection";
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { chatModels } from "@/lib/ai/models";
import { myProvider } from "@/lib/ai/providers";
import type { AITool } from "@/lib/db/schema";
import {
  useWriteContextRouterExecutePaidQuery,
  useWriteContextRouterExecuteBatchPaidQuery,
} from "@/lib/generated";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn } from "@/lib/utils";
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
import { PaymentDialog } from "./tools/payment-dialog";
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
  const primaryTool: AITool | null = selectedTool ?? activeTools[0] ?? null;
  const [executingTool, setExecutingTool] = useState<AITool | null>(null);
  const { stage, setStage, reset: resetPaymentStatus } = usePaymentStatus();
  const { activeWallet, isEmbeddedWallet } = useWalletIdentity();
  const { fundWallet } = useFundWallet();

  // Wallet and contract addresses
  // Rename address to wagmiAddress to avoid confusion
  const { address: wagmiAddress, chain } = useAccount();
  const chainId = chain?.id; // Use the actual connected chain, not the configured one
  // Use activeWallet.address as the source of truth for the UI
  const walletAddress = activeWallet?.address as `0x${string}` | undefined;
  const { switchChainAsync } = useSwitchChain();
  const routerAddress =
    (process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}`) ||
    (process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS_SEPOLIA as `0x${string}`);
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  // Disable input during payment flow (stages 1-3)
  const isPaymentInProgress = stage !== "idle" && stage !== "thinking";

  // Detect mismatch between Privy active wallet and wagmi account.
  // If this happens while we *think* we're using an embedded wallet,
  // it usually means a browser extension wallet is connected for a
  // different Privy user. In that case, we should not fire on-chain
  // transactions from this session.
  const hasWalletMismatch =
    Boolean(walletAddress) &&
    Boolean(wagmiAddress) &&
    walletAddress?.toLowerCase() !== wagmiAddress?.toLowerCase();

  // USDC balance check
  const { refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: false },
  });

  // USDC allowance (manual refetch before spending)
  const { refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: walletAddress ? [walletAddress, routerAddress] : undefined,
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
  const [executingTools, setExecutingTools] = useState<AITool[]>([]);
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
  }, [executeError, batchExecuteError, isPaying, resetExecute, resetBatchExecute, setMessages, resetPaymentStatus]);

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

  const submitForm = useCallback(
    (toolInvocation?: ToolInvocationPayload | BatchToolInvocationPayload) => {
      const trimmedInput = input.trim();
      const hasText = trimmedInput.length > 0;

      if (
        !toolInvocation &&
        !isReadonly &&
        (selectedTool || activeTools.length > 0)
      ) {
        setShowPayDialog(true);
        return;
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
      let sendOptions: { body: { toolInvocations: { toolId: string; transactionHash: `0x${string}` }[] } } | undefined;
      if (toolInvocation) {
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
      activeTools.length,
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

  // After execute success: verify + execute tool server-side and then send the augmented message
  useEffect(() => {
    const isSuccess = isExecSuccess || isBatchExecSuccess;
    if (!isSuccess || !lastExecutedTx) {
      return;
    }

    // Handle batch execution (multiple tools)
    if (executingTools.length > 1) {
      const toolNames = executingTools.map((t) => t.name).join(", ");
      setStage("planning", toolNames);
      submitForm({
        toolInvocations: executingTools.map((tool) => ({
          toolId: tool.id,
          transactionHash: lastExecutedTx,
        })),
        fallbackText: `Using ${toolNames}`,
      });
    } else if (executingTool) {
      // Handle single tool execution
      setStage("planning", executingTool.name);
      submitForm({
        toolId: executingTool.id,
        transactionHash: lastExecutedTx,
        fallbackText: `Using ${executingTool.name}`,
      });
    }

    setIsPaying(false);
    setShowPayDialog(false);
    setLastExecutedTx(undefined);
    setExecutingTool(null);
    setExecutingTools([]);
    resetExecute();
    resetBatchExecute();
  }, [
    executingTool,
    executingTools,
    isExecSuccess,
    isBatchExecSuccess,
    lastExecutedTx,
    setStage,
    submitForm,
    resetExecute,
    resetBatchExecute,
  ]);

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

    try {
      setIsFundingWallet(true);
      await fundWallet({
        address: activeWallet.address,
        options: {
          chain: base,
          asset: "USDC",
          amount: amountToFund,
        },
      });
      await refetchBalance();
      toast.success("Funds added. You can try the tool again.");
      setShowAddFundsDialog(false);
      setFundingRequest(null);
      setShowPayDialog(true);
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
  }, [activeWallet?.address, fundWallet, fundingRequest, refetchBalance]);

  useEffect(() => {
    if (status === "ready") {
      resetPaymentStatus();
    }
  }, [status, resetPaymentStatus]);

  const confirmPayment = useCallback(async () => {
    // Determine which tools to pay for
    const toolsToPay = selectedTool ? [selectedTool] : activeTools;
    
    if (toolsToPay.length === 0 || !walletAddress || !routerAddress || !usdcAddress) {
      toast.error("Missing wallet or contract configuration.");
      return;
    }

    // Double-check network (shouldn't happen with UI guard, but safety first)
    if (chainId !== base.id) {
      toast.error("Please switch to Base mainnet first.");
      return;
    }

    try {
      setIsPaying(true);

      // Calculate total amount needed
      let totalAmount = 0n;
      for (const tool of toolsToPay) {
        totalAmount += parseUnits(tool.pricePerQuery ?? "0.00", 6);
      }

      // Calculate max allowance for all tools combined
      let maxAllowance = 0n;
      for (const tool of toolsToPay) {
        const pricePerQuery = Number.parseFloat(tool.pricePerQuery ?? "0.01");
        maxAllowance += parseUnits((pricePerQuery * 1000).toString(), 6);
      }

      // Check USDC balance first
      const { data: balanceData } = await refetchBalance();
      const balance = (balanceData as bigint | undefined) ?? 0n;

      const totalAmountStr = (Number(totalAmount) / 1_000_000).toFixed(2);
      const toolNames = toolsToPay.map((t) => t.name).join(", ");

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

      // Check and handle allowance
      const allowanceRes = await refetchAllowance();
      const allowance = (allowanceRes.data as bigint | undefined) ?? 0n;
      if (allowance < totalAmount) {
        setStage("setting-cap", toolNames);
        await writeErc20Async({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [routerAddress, maxAllowance],
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      setStage("confirming-payment", toolNames);

      // Single tool: use single execute
      if (toolsToPay.length === 1) {
        const tool = toolsToPay[0];
        setExecutingTool(tool);
        writeExecute({
          args: [0n, tool.developerWallet as `0x${string}`, totalAmount],
        });
      } else {
        // Multiple tools: use batch execute
        setExecutingTools(toolsToPay);
        const toolIds = toolsToPay.map(() => 0n); // Using 0n for MVP
        const developerWallets = toolsToPay.map(
          (t) => t.developerWallet as `0x${string}`
        );
        const amounts = toolsToPay.map((t) =>
          parseUnits(t.pricePerQuery ?? "0.00", 6)
        );

        writeBatchExecute({
          args: [toolIds, developerWallets, amounts],
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

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
        const toolNames = toolsToPay.map((t) => t.name).join(", ");
        if (isEmbeddedWallet) {
          setFundingRequest({
            amount: (Number(totalAmount) / 1_000_000).toFixed(2),
            toolName: toolNames,
          });
          setShowAddFundsDialog(true);
          toast.error("You need to add USDC before running these tools.");
        } else {
          toast.error("Insufficient USDC balance");
        }
      } else {
        toast.error("Payment failed. Please try again.");
      }

      setIsPaying(false);
      setShowPayDialog(false);
      resetPaymentStatus();
    }
  }, [
    selectedTool,
    activeTools,
    walletAddress,
    chainId,
    routerAddress,
    usdcAddress,
    refetchBalance,
    isEmbeddedWallet,
    hasWalletMismatch,
    refetchAllowance,
    writeErc20Async,
    writeExecute,
    writeBatchExecute,
    setStage,
    resetPaymentStatus,
  ]);

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
                : isPaymentInProgress
                  ? "Processing payment..."
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

          {status === "submitted" ? (
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
          )}
        </PromptInputToolbar>
      </PromptInput>
      {(selectedTool || activeTools.length > 0) ? (
        <PaymentDialog
          chainId={chainId}
          isBusy={isPaying || isExecutePending || isExecConfirming || isBatchExecutePending || isBatchExecConfirming}
          isSwitchingNetwork={isSwitchingNetwork}
          onConfirm={confirmPayment}
          onOpenChange={setShowPayDialog}
          onSwitchNetwork={handleSwitchNetwork}
          open={showPayDialog}
          price={
            selectedTool
              ? (selectedTool.pricePerQuery ?? "0.00")
              : activeTools.reduce(
                  (sum, t) => sum + Number(t.pricePerQuery ?? 0),
                  0
                ).toFixed(2)
          }
          toolName={
            selectedTool
              ? selectedTool.name
              : activeTools.length === 1
                ? activeTools[0].name
                : `${activeTools.length} tools`
          }
        />
      ) : null}
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
        walletAddress={activeWallet?.address}
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

  useEffect(() => {
    setOptimisticModelId(selectedModelId);
  }, [selectedModelId]);

  const selectedModel = chatModels.find(
    (model) => model.id === optimisticModelId
  );

  return (
    <PromptInputModelSelect
      onValueChange={(modelName) => {
        if (isReadonly) {
          return;
        }
        const model = chatModels.find((m) => m.name === modelName);
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
          {chatModels.map((model) => (
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
