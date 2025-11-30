import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { EarningsPanel } from "@/components/tools/earnings-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAIToolsByDeveloper } from "@/lib/db/queries";
import { ToolCard } from "./tool-card";

export default async function DeveloperToolsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Only developers should access this page
  if (!session.user.isDeveloper) {
    redirect("/");
  }

  // Get user's tools
  const tools = await getAIToolsByDeveloper({ developerId: session.user.id });

  return (
    <div className="mx-auto flex h-dvh max-w-4xl flex-col gap-8 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-2xl tracking-tight">My Tools</h1>
        <Link href="/contribute">
          <Button type="button">Create New Tool</Button>
        </Link>
      </div>

      <EarningsPanel />

      <div className="flex flex-col gap-4">
        <h2 className="font-semibold text-lg">Your Tools</h2>

        {tools.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-8 text-center">
            <p className="mb-2 font-semibold text-foreground text-lg">
              No tools yet
            </p>
            <p className="mb-6 max-w-sm text-muted-foreground text-sm">
              Create your first tool to start earning from the marketplace.
            </p>
            <Link href="/contribute">
              <Button variant="outline" type="button">
                Create Your First Tool
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={{
                  id: tool.id,
                  name: tool.name,
                  description: tool.description,
                  category: tool.category,
                  pricePerQuery: tool.pricePerQuery,
                  totalQueries: tool.totalQueries,
                  totalRevenue: tool.totalRevenue,
                  isActive: tool.isActive,
                  isVerified: tool.isVerified,
                  toolSchema: tool.toolSchema,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

