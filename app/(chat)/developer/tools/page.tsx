import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
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
    <div className="flex min-h-svh flex-col items-center justify-start bg-background px-4 py-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <h1 className="font-semibold text-2xl tracking-tight">My Tools</h1>
            <p className="text-muted-foreground text-sm">
              Manage your AI tools and track your earnings.
            </p>
          </div>
          <Link href="/contribute">
            <Button className="w-full md:w-auto" size="sm">
              <Plus className="h-4 w-4" />
              Create Tool
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <EarningsPanel />

          <div className="space-y-4">
            {tools.length > 0 && (
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Active Tools
              </h2>
            )}

            {tools.length === 0 ? (
              <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mb-2 font-semibold text-lg">
                  No tools created yet
                </h3>
                <p className="mb-6 max-w-sm text-muted-foreground text-sm">
                  Start building your portfolio by creating your first AI tool.
                  You'll earn USDC every time someone uses it.
                </p>
                <Link href="/contribute">
                  <Button>Create Your First Tool</Button>
                </Link>
              </Card>
            ) : (
              <div className="grid gap-4">
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
      </div>
    </div>
  );
}
