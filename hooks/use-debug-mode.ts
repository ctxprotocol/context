"use client";

import { useEffect, useState } from "react";

export function useDebugMode() {
  const [isDebugMode, setIsDebugMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("isDebugMode");
    // Persisted value is stored as the string "true" or "false".
    // We only enable debug mode when the stored value is exactly "true".
    if (stored === "true") {
      setIsDebugMode(true);
    }
  }, []);

  const toggleDebugMode = () => {
    const newValue = !isDebugMode;
    setIsDebugMode(newValue);
    localStorage.setItem("isDebugMode", String(newValue));
  };

  return { isDebugMode, toggleDebugMode };
}

