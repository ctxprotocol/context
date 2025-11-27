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

type ContextSidebarContextType = {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  toggle: () => void;
  open: () => void;
  close: () => void;
};

const STORAGE_KEY = "context-sidebar-open";

const ContextSidebarContext = createContext<ContextSidebarContextType | null>(null);

export function ContextSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpenState] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedOpen = localStorage.getItem(STORAGE_KEY);
      if (storedOpen !== null) {
        setIsOpenState(storedOpen === "true");
      }
    }
  }, []);

  // Persist changes to localStorage
  const setIsOpen = useCallback((value: boolean) => {
    setIsOpenState(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(value));
    }
  }, []);

  const toggle = useCallback(() => {
    setIsOpenState((prev) => {
      const newValue = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, String(newValue));
      }
      return newValue;
    });
  }, []);

  const open = useCallback(() => {
    setIsOpenState(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }, []);

  const close = useCallback(() => {
    setIsOpenState(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "false");
    }
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      toggle,
      open,
      close,
    }),
    [isOpen, setIsOpen, toggle, open, close]
  );

  return (
    <ContextSidebarContext.Provider value={value}>
      {children}
    </ContextSidebarContext.Provider>
  );
}

export function useContextSidebar() {
  const context = useContext(ContextSidebarContext);
  if (!context) {
    throw new Error("useContextSidebar must be used within ContextSidebarProvider");
  }
  return context;
}
