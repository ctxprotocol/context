import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminNav } from "../admin-nav";
import { AdminEarningsPanel } from "./admin-earnings-panel";
import { CostEstimationStats } from "./cost-estimation-stats";

const ADMIN_EMAILS = ["alex.r.macleod@gmail.com"];

export default async function AdminEarningsPage() {
  const session = await auth();
  const userEmail = session?.user?.email || "";

  if (!session?.user || !ADMIN_EMAILS.includes(userEmail)) {
    return redirect("/");
  }

  return (
    <div className="flex min-h-svh flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-4xl space-y-6">
        <AdminNav />
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">
            Platform Earnings
          </h1>
          <p className="text-muted-foreground text-sm">
            Claim platform fees (10% of tool payments) and model costs (100%
            from convenience tier).
          </p>
        </div>

        {/* Claim Panel */}
        <AdminEarningsPanel />

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              How Platform Earnings Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground text-sm">
            <div>
              <h4 className="mb-1 font-medium text-foreground">
                Tool Fees (10%)
              </h4>
              <p>
                When users pay for tools, 90% goes to the developer and 10% goes
                to the platform. This is automatically split on-chain by the
                ContextRouter contract.
              </p>
            </div>
            <div>
              <h4 className="mb-1 font-medium text-foreground">
                Model Costs (100%)
              </h4>
              <p>
                Convenience tier users pay estimated model costs upfront. This
                goes 100% to the platform to cover API costs. The actual cost
                may be lower than estimated (conservative pricing).
              </p>
            </div>
            <div>
              <h4 className="mb-1 font-medium text-foreground">Claiming</h4>
              <p>
                Both fee types accumulate in the contract&apos;s{" "}
                <code className="rounded bg-muted px-1">platformBalance</code>.
                You claim them together with a single transaction. Only the
                contract owner can claim.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cost Estimation Stats */}
        <CostEstimationStats />
      </div>
    </div>
  );
}
