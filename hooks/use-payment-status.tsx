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
  | "thinking";

type PaymentStatusContextType = {
  stage: PaymentStage;
  toolName: string | null;
  setStage: (stage: PaymentStage, toolName?: string) => void;
  reset: () => void;
};

const PaymentStatusContext = createContext<
  PaymentStatusContextType | undefined
>(undefined);

export function PaymentStatusProvider({ children }: { children: ReactNode }) {
  const [stage, setStageState] = useState<PaymentStage>("idle");
  const [toolName, setToolName] = useState<string | null>(null);

  const setStage = useCallback((newStage: PaymentStage, name?: string) => {
    setStageState(newStage);
    if (name) {
      setToolName(name);
    }
  }, []);

  const reset = useCallback(() => {
    setStageState("idle");
    setToolName(null);
  }, []);

  return (
    <PaymentStatusContext.Provider value={{ stage, toolName, setStage, reset }}>
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
    case "querying-tool":
      return toolName ? `Querying ${toolName}...` : "Querying tool...";
    case "thinking":
      return "Thinking...";
    default:
      return "Thinking...";
  }
}
