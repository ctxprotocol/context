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
          <ContributeForm />
        </Suspense>
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

