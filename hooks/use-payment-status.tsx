"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

export type PaymentStage =
  | "idle"
  | "setting-cap"
  | "confirming-payment"
  | "querying-tool"
  | "planning"
  | "discovering-tools" // Auto Mode: AI is searching and selecting tools
  | "awaiting-tool-approval" // Auto Mode: Waiting for user to approve selected tools
  | "executing"
  | "thinking";

export type ExecutionLogEntry = {
  type: "query" | "result" | "error";
  toolName: string;
  message: string;
  timestamp: number;
};

export type TransactionStatus = "pending" | "submitted" | "confirmed" | "failed";

export type TransactionInfo = {
  hash: string | null;
  status: TransactionStatus;
  blockNumber?: number;
  error?: string;
};

type PaymentStatusContextType = {
  stage: PaymentStage;
  toolName: string | null;
  streamingCode: string | null;
  debugResult: string | null;
  executionLogs: ExecutionLogEntry[];
  // Reasoning/thinking support for models like Kimi K2, DeepSeek, etc.
  streamingReasoning: string | null;
  isReasoningComplete: boolean;
  // Transaction tracking for blockchain payments
  transactionInfo: TransactionInfo;
  setStage: (stage: PaymentStage, toolName?: string) => void;
  setStreamingCode: (code: string | null) => void;
  setDebugResult: (result: string | null) => void;
  addExecutionLog: (log: ExecutionLogEntry) => void;
  setStreamingReasoning: (reasoning: string | null) => void;
  setReasoningComplete: (complete: boolean) => void;
  setTransactionInfo: (info: Partial<TransactionInfo>) => void;
  reset: () => void;
};

const PaymentStatusContext = createContext<
  PaymentStatusContextType | undefined
>(undefined);

const DEFAULT_TX_INFO: TransactionInfo = {
  hash: null,
  status: "pending",
};

export function PaymentStatusProvider({ children }: { children: ReactNode }) {
  const [stage, setStageState] = useState<PaymentStage>("idle");
  const [toolName, setToolName] = useState<string | null>(null);
  const [streamingCode, setStreamingCodeState] = useState<string | null>(null);
  const [debugResult, setDebugResultState] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogEntry[]>([]);
  // Reasoning/thinking state
  const [streamingReasoning, setStreamingReasoningState] = useState<
    string | null
  >(null);
  const [isReasoningComplete, setIsReasoningComplete] = useState(false);
  // Transaction tracking state
  const [transactionInfo, setTransactionInfoState] =
    useState<TransactionInfo>(DEFAULT_TX_INFO);

  const setStage = useCallback((newStage: PaymentStage, name?: string) => {
    setStageState(newStage);
    if (name) {
      setToolName(name);
    }
    // Clear execution logs when starting a new execution
    if (newStage === "executing") {
      setExecutionLogs([]);
    }
    // Clear reasoning and code state when starting discovery or planning
    // This ensures a fresh state for each new AI thinking phase
    if (newStage === "discovering-tools" || newStage === "planning") {
      setStreamingReasoningState(null);
      setIsReasoningComplete(false);
      setStreamingCodeState(null);
    }
    // Reset transaction info when starting a new payment
    if (newStage === "confirming-payment") {
      setTransactionInfoState(DEFAULT_TX_INFO);
    }
  }, []);

  const setStreamingCode = useCallback((code: string | null) => {
    setStreamingCodeState(code);
  }, []);

  const setDebugResult = useCallback((result: string | null) => {
    setDebugResultState(result);
  }, []);

  const addExecutionLog = useCallback((log: ExecutionLogEntry) => {
    setExecutionLogs((prev) => [...prev, log]);
  }, []);

  const setStreamingReasoning = useCallback((reasoning: string | null) => {
    setStreamingReasoningState(reasoning);
  }, []);

  const setReasoningComplete = useCallback((complete: boolean) => {
    setIsReasoningComplete(complete);
  }, []);

  const setTransactionInfo = useCallback((info: Partial<TransactionInfo>) => {
    setTransactionInfoState((prev) => ({ ...prev, ...info }));
  }, []);

  const reset = useCallback(() => {
    setStageState("idle");
    setToolName(null);
    setStreamingCodeState(null);
    setDebugResultState(null);
    setExecutionLogs([]);
    setStreamingReasoningState(null);
    setIsReasoningComplete(false);
    setTransactionInfoState(DEFAULT_TX_INFO);
  }, []);

  return (
    <PaymentStatusContext.Provider
      value={{
        stage,
        toolName,
        streamingCode,
        debugResult,
        executionLogs,
        streamingReasoning,
        isReasoningComplete,
        transactionInfo,
        setStage,
        setStreamingCode,
        setDebugResult,
        addExecutionLog,
        setStreamingReasoning,
        setReasoningComplete,
        setTransactionInfo,
        reset,
      }}
    >
      {children}
    </PaymentStatusContext.Provider>
  );
}

export function usePaymentStatus() {
  const context = useContext(PaymentStatusContext);
  if (!context) {
    throw new Error(
      "usePaymentStatus must be used within PaymentStatusProvider"
    );
  }
  return context;
}

/**
 * Get human-readable status message for each payment stage
 * Follows design-system.json typography (text-sm, muted-foreground)
 *
 * AUTO MODE FLOW:
 * 1. "discovering-tools" - AI analyzes query and searches marketplace for tools
 * 2. "awaiting-tool-approval" - Tools selected, waiting for payment confirmation
 * 3. "confirming-payment" - Processing blockchain payment
 * 4. "planning" - AI planning how to use the selected tools (generates code)
 * 5. "executing" - Running the generated code to call tools
 * 6. "thinking" - AI analyzing results and formulating response
 *
 * MANUAL MODE FLOW:
 * 1. "setting-cap" - User setting spending cap
 * 2. "confirming-payment" - Processing blockchain payment
 * 3. "planning" - AI planning how to use the selected tools
 * 4. "executing" - Running the generated code
 * 5. "thinking" - Formulating response
 */
export function getPaymentStatusMessage(
  stage: PaymentStage,
  toolName: string | null
): string {
  switch (stage) {
    case "setting-cap":
      return "Setting payment cap...";
    case "confirming-payment":
      return toolName
        ? `Confirming payment for ${toolName}...`
        : "Confirming payment...";
    case "planning":
      return "Planning execution...";
    case "discovering-tools":
      return "Discovering tools...";
    case "awaiting-tool-approval":
      return toolName
        ? `Found: ${toolName}`
        : "Selecting tools...";
    case "querying-tool":
      return toolName ? `Querying ${toolName}...` : "Querying tool...";
    case "executing":
      return "Executing...";
    case "thinking":
      return "Analyzing results...";
    default:
      return "Processing...";
  }
}
