"use client";

import { useEffect, useState } from "react";

export function useDebugMode() {
  const [isDebugMode, setIsDebugMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("isDebugMode");
    if (stored) {
      setIsDebugMode(JSON.stringify(stored) === "true");
    }
  }, []);

  const toggleDebugMode = () => {
    const newValue = !isDebugMode;
    setIsDebugMode(newValue);
    localStorage.setItem("isDebugMode", String(newValue));
  };

  return { isDebugMode, toggleDebugMode };
}

