"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getAndClearReferralCode } from "./use-referral-capture";

export function useSessionSync() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { data: session, status } = useSession();
  const router = useRouter();
  const isSyncing = useRef(false);

  useEffect(() => {
    // Only run once both systems are ready
    if (!ready || status === "loading" || isSyncing.current) {
      return;
    }

    const privyIsAuthenticated = authenticated && user;
    const nextAuthIsAuthenticated = !!session;

    // Case 1: Privy authenticated, NextAuth not → Sign in
    if (privyIsAuthenticated && !nextAuthIsAuthenticated) {
      console.log("Session Sync: Signing in to NextAuth...");
      isSyncing.current = true;

      const syncSignIn = async () => {
        try {
          const token = await getAccessToken();
          if (token) {
            const result = await signIn("credentials", {
              token,
              redirect: false,
            });

            if (result?.error) {
              console.error("Session sync sign-in failed:", result.error);
              toast.error("Authentication failed. Please try again.");
            } else {
              // Apply referral code if one was captured from URL (fire and forget)
              const refCode = getAndClearReferralCode();
              if (refCode) {
                fetch("/api/referral/apply", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ code: refCode }),
                }).catch(() => {
                  // Silently ignore - referral tracking is non-critical
                });
              }
              router.refresh(); // Refresh to update server components
            }
          }
        } catch (error) {
          console.error("Session sync error:", error);
        } finally {
          isSyncing.current = false;
        }
      };

      syncSignIn();
    }

    // Case 2: Privy not authenticated, NextAuth is → Sign out
    else if (!privyIsAuthenticated && nextAuthIsAuthenticated) {
      console.log("Session Sync: Signing out of NextAuth...");
      isSyncing.current = true;
      signOut({ redirect: false }).finally(() => {
        isSyncing.current = false;
        router.refresh();
      });
    }
  }, [ready, authenticated, user, session, status, getAccessToken, router]);
}
