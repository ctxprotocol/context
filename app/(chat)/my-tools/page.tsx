import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { EarningsPanel } from "@/components/tools/earnings-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAIToolsByDeveloper } from "@/lib/db/queries";

export default async function MyToolsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get user's tools
  const tools = await getAIToolsByDeveloper(session.user.id);

  // Get wallet address from session (you'll need to add this to your user schema/session)
  const walletAddress = session.user.walletAddress as `0x${string}` | undefined;

  return (
    <div className="mx-auto flex h-dvh max-w-4xl flex-col gap-6 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-3xl">My Tools</h1>
        <Link href="/contribute">
          <Button>Create New Tool</Button>
        </Link>
      </div>

      <EarningsPanel developerAddress={walletAddress} />

      <div className="flex flex-col gap-4">
        <h2 className="font-semibold text-xl">Your Tools</h2>

        {tools.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">
              You haven't created any tools yet.
            </p>
            <Link href="/contribute">
              <Button className="mt-4" variant="outline">
                Create Your First Tool
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {tools.map((tool) => (
              <Card className="p-4" key={tool.id}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold">{tool.name}</h3>
                    <Badge variant={tool.isActive ? "default" : "secondary"}>
                      {tool.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {tool.description && (
                    <p className="line-clamp-2 text-muted-foreground text-sm">
                      {tool.description}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground text-xs">
                        ${tool.pricePerQuery} per query
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {tool.totalQueries} queries
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="font-medium">
                        ${Number(tool.totalRevenue).toFixed(2)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        Total Revenue
                      </span>
                    </div>
                  </div>

                  {tool.isVerified && (
                    <Badge className="w-fit" variant="outline">
                      ✓ Verified
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
