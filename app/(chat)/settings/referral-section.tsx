"use client";

import { Check, Copy, Gift, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoaderIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ReferralData = {
  referralCode: string | null;
  totalReferred: number;
  convertedCount: number;
};

/**
 * ReferralSection - Protocol Ledger Referral UI
 *
 * Displays user's referral code with a subtle hint about TGE rewards.
 * Savvy users will understand the implication without explicit "points" language.
 */
export function ReferralSection() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchReferralData() {
      try {
        const response = await fetch("/api/referral");
        if (response.ok) {
          const json = await response.json();
          setData(json);
        }
      } catch (_error) {
        // Silently fail - referrals are non-critical
      } finally {
        setLoading(false);
      }
    }
    fetchReferralData();
  }, []);

  const handleCopy = async () => {
    if (!data?.referralCode) return;

    const referralUrl = `${window.location.origin}?ref=${data.referralCode}`;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 animate-pulse rounded-lg bg-muted" />
            <div className="space-y-2">
              <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
            <Gift className="size-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Invite Friends</CardTitle>
            <CardDescription>
              Share Context with others and grow the network
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Referral Link */}
        <div className="space-y-2">
          <label className="font-medium text-sm" htmlFor="referral-link">
            Your Referral Link
          </label>
          <div className="flex gap-2">
            <Input
              className="font-mono text-sm"
              id="referral-link"
              readOnly
              value={
                data?.referralCode
                  ? `${typeof window !== "undefined" ? window.location.origin : ""}?ref=${data.referralCode}`
                  : "Loading..."
              }
            />
            <Button
              className="shrink-0"
              disabled={!data?.referralCode}
              onClick={handleCopy}
              size="icon"
              variant="outline"
            >
              {copied ? (
                <Check className="size-4 text-green-500" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Stats */}
        {data && (data.totalReferred > 0 || data.convertedCount > 0) && (
          <div className="flex gap-4 rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-semibold">{data.totalReferred}</span>{" "}
                <span className="text-muted-foreground">referred</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-semibold">{data.convertedCount}</span>{" "}
                <span className="text-muted-foreground">converted</span>
              </span>
            </div>
          </div>
        )}

        {/* Subtle TGE hint - for savvy users */}
        <div className="flex items-start gap-2 rounded-md bg-violet-500/10 p-2 dark:bg-violet-500/15">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
          <p className="text-violet-600/90 text-xs leading-relaxed dark:text-violet-400/90">
            <span className="font-medium">Early supporter?</span>{" "}
            All protocol activity is recorded on-chain and off. When the time
            comes, those who helped grow the network won&apos;t be forgotten.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}



