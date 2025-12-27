"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

const REFERRAL_CODE_KEY = "context_referral_code";

/**
 * Captures referral code from URL params and stores in localStorage.
 * Called from the root layout so it runs on every page load.
 *
 * URL format: https://context.app?ref=XXXXXXXX
 *
 * The code is picked up by useApplyReferral after authentication completes.
 */
export function useReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode && refCode.length >= 6 && refCode.length <= 12) {
      // Only store if we don't already have one (first referrer wins)
      const existing = localStorage.getItem(REFERRAL_CODE_KEY);
      if (!existing) {
        localStorage.setItem(REFERRAL_CODE_KEY, refCode.toLowerCase());
        console.log("[referral] Captured referral code:", refCode);
      }
    }
  }, [searchParams]);
}

/**
 * Get the stored referral code (if any) and clear it.
 * Called after applying the referral to prevent re-application.
 */
export function getAndClearReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const code = localStorage.getItem(REFERRAL_CODE_KEY);
  if (code) {
    localStorage.removeItem(REFERRAL_CODE_KEY);
  }
  return code;
}

/**
 * Check if there's a pending referral code without clearing it.
 */
export function getPendingReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFERRAL_CODE_KEY);
}



