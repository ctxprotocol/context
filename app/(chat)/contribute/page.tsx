import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ContributeForm } from "./contribute-form";

export default async function ContributePage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <Card className="max-w-xl w-full">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Please sign in to register a tool on Context.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">
            Contribute a Tool
          </h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            List an HTTP endpoint that sells curated context to the marketplace.
            Configure pricing in USDC, provide an endpoint, and we’ll handle the
            payment flow for you.
          </p>
        </div>
        <Suspense fallback={<CardSkeleton />}>
          <ContributeForm developerWallet={session.user.walletAddress || ""} />
        </Suspense>

        <div className="border-t pt-8 mt-8 text-center space-y-4">
          <h3 className="font-medium text-sm">Building complex logic?</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            For high-performance skills that require custom code execution, submit a
            Verified Native Skill via Pull Request to our Open Source Registry.
          </p>
          <a
            href="https://github.com/ctxprotocol/context/tree/main/lib/ai/skills/community"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            View Registry & Instructions
            <svg
              className="ml-1 size-3"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Loading form…</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-24 rounded-md bg-muted" />
      </CardContent>
    </Card>
  );
}

