"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Spending cap options in USDC (10x scale for meaningful budgets)
export const SPENDING_CAP_OPTIONS = [
  { label: "$10", value: 10 },
  { label: "$50", value: 50 },
  { label: "$100", value: 100 },
  { label: "$250", value: 250 },
] as const;

type AutoPayContextType = {
  isAutoPay: boolean;
  spendingCap: number;
  spentAmount: number;
  remainingBudget: number;
  isAutoMode: boolean;
  isFullAgenticMode: boolean;
  setIsAutoPay: (value: boolean) => void;
  setSpendingCap: (value: number) => void;
  setIsAutoMode: (value: boolean) => void;
  recordSpend: (amount: number) => boolean; // Returns false if over budget
  resetSpentAmount: () => void;
  canAfford: (amount: number) => boolean;
};

const STORAGE_KEYS = {
  autoPay: "context-auto-pay",
  spendingCap: "context-spending-cap",
  spentAmount: "context-spent-amount",
  autoMode: "context-auto-mode",
} as const;

// Default values used before hydration
const DEFAULT_VALUES = {
  isAutoPay: false,
  spendingCap: 50, // Default to $50 (middle option)
  spentAmount: 0,
  isAutoMode: false,
};

const AutoPayContext = createContext<AutoPayContextType | null>(null);

export function AutoPayProvider({ children }: { children: ReactNode }) {
  const [isAutoPay, setIsAutoPayState] = useState(DEFAULT_VALUES.isAutoPay);
  const [spendingCap, setSpendingCapState] = useState(DEFAULT_VALUES.spendingCap);
  const [spentAmount, setSpentAmountState] = useState(DEFAULT_VALUES.spentAmount);
  const [isAutoMode, setIsAutoModeState] = useState(DEFAULT_VALUES.isAutoMode);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedAutoPay = localStorage.getItem(STORAGE_KEYS.autoPay);
      const storedCap = localStorage.getItem(STORAGE_KEYS.spendingCap);
      const storedSpent = localStorage.getItem(STORAGE_KEYS.spentAmount);
      const storedAutoMode = localStorage.getItem(STORAGE_KEYS.autoMode);

      if (storedAutoPay !== null) {
        setIsAutoPayState(storedAutoPay === "true");
      }
      if (storedCap !== null) {
        setSpendingCapState(Number.parseFloat(storedCap));
      }
      if (storedSpent !== null) {
        setSpentAmountState(Number.parseFloat(storedSpent));
      }
      if (storedAutoMode !== null) {
        setIsAutoModeState(storedAutoMode === "true");
      }
    }
  }, []);

  // Persist changes to localStorage
  const setIsAutoPay = useCallback((value: boolean) => {
    setIsAutoPayState(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.autoPay, String(value));
      if (!value) {
        // Disable Auto Mode when Auto Pay is disabled
        setIsAutoModeState(false);
        localStorage.setItem(STORAGE_KEYS.autoMode, "false");
      }
    }
  }, []);

  const setSpendingCap = useCallback((value: number) => {
    setSpendingCapState(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.spendingCap, String(value));
    }
  }, []);

  const setIsAutoMode = useCallback(
    (value: boolean) => {
      if (value && !isAutoPay) {
        // Auto-enable Auto Pay when enabling Auto Mode
        setIsAutoPayState(true);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEYS.autoPay, "true");
          // Reset spent amount
          setSpentAmountState(0);
          localStorage.setItem(STORAGE_KEYS.spentAmount, "0");
        }
      }
      setIsAutoModeState(value);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.autoMode, String(value));
      }
    },
    [isAutoPay]
  );

  const remainingBudget = Math.max(0, spendingCap - spentAmount);
  const isFullAgenticMode = isAutoPay && isAutoMode;

  const canAfford = useCallback(
    (amount: number) => {
      if (!isAutoPay) return false;
      return amount <= remainingBudget;
    },
    [isAutoPay, remainingBudget]
  );

  const recordSpend = useCallback(
    (amount: number) => {
      if (!canAfford(amount)) {
        return false;
      }
      const newSpent = spentAmount + amount;
      setSpentAmountState(newSpent);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.spentAmount, String(newSpent));
      }
      return true;
    },
    [canAfford, spentAmount]
  );

  const resetSpentAmount = useCallback(() => {
    setSpentAmountState(0);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.spentAmount, "0");
    }
  }, []);

  const value = useMemo(
    () => ({
      isAutoPay,
      spendingCap,
      spentAmount,
      remainingBudget,
      isAutoMode,
      isFullAgenticMode,
      setIsAutoPay,
      setSpendingCap,
      setIsAutoMode,
      recordSpend,
      resetSpentAmount,
      canAfford,
    }),
    [
      isAutoPay,
      spendingCap,
      spentAmount,
      remainingBudget,
      isAutoMode,
      isFullAgenticMode,
      setIsAutoPay,
      setSpendingCap,
      setIsAutoMode,
      recordSpend,
      resetSpentAmount,
      canAfford,
    ]
  );

  return (
    <AutoPayContext.Provider value={value}>
      {children}
    </AutoPayContext.Provider>
  );
}

export function useAutoPay() {
  const context = useContext(AutoPayContext);
  if (!context) {
    throw new Error("useAutoPay must be used within AutoPayProvider");
  }
  return context;
}

