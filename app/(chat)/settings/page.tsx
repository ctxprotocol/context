import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiKeysSection } from "./api-keys";
import { LinkedWalletsSection } from "./linked-wallets";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Please sign in to access your settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-start bg-background px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="font-semibold text-3xl tracking-tight">Settings</h1>
          <p className="mx-auto max-w-lg text-muted-foreground text-sm">
            Manage your API keys, model preferences, and portfolio wallets.
          </p>
        </div>

        <Suspense fallback={<SettingsSkeleton />}>
          <SettingsForm />
        </Suspense>

        <Suspense fallback={<SettingsSkeleton />}>
          <LinkedWalletsSection />
        </Suspense>

        <Suspense fallback={<SettingsSkeleton />}>
          <ApiKeysSection />
        </Suspense>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Loading settings…</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-10 animate-pulse rounded-md bg-muted" />
        <div className="h-10 animate-pulse rounded-md bg-muted" />
        <div className="h-24 animate-pulse rounded-md bg-muted" />
      </CardContent>
    </Card>
  );
}
