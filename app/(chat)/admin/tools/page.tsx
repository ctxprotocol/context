import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getActiveAIToolsFull } from "@/lib/db/queries";
import { AdminNav } from "../admin-nav";
import { VerifyButton } from "./verify-button";

const ADMIN_EMAILS = ["alex.r.macleod@gmail.com"];

export default async function AdminToolsPage() {
  const session = await auth();
  const userEmail = session?.user?.email || "";

  if (!session?.user || !ADMIN_EMAILS.includes(userEmail)) {
    return redirect("/");
  }

  const tools = await getActiveAIToolsFull();

  return (
    <div className="flex min-h-svh flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-5xl space-y-6">
        <AdminNav />
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">
            Featured Tools
          </h1>
          <p className="text-muted-foreground text-sm">
            Curate which tools appear in the featured section. All tools are
            permissionless — featuring is optional promotion, not gatekeeping.
          </p>
        </div>

        <Card>
          <CardHeader className="border-b px-6 py-4">
            <CardTitle className="font-medium text-base">
              All Active Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 border-b hover:bg-transparent">
                  <TableHead className="w-[150px] pl-6">Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="max-w-[300px]">
                    Endpoint / Module
                  </TableHead>
                  <TableHead>Queries</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.map((tool) => {
                  const schema = tool.toolSchema as Record<string, unknown>;
                  const endpoint = (schema?.endpoint as string) || "Unknown";
                  const typeLabel = "MCP";
                  const typeColor = "bg-blue-600";

                  return (
                    <TableRow
                      className="border-border/50 border-b last:border-none hover:bg-muted/50"
                      key={tool.id}
                    >
                      <TableCell className="pl-6">
                        {tool.isVerified ? (
                          <Badge
                            className="border-transparent bg-emerald-600 text-white shadow-sm hover:bg-emerald-600/90"
                            variant="default"
                          >
                            Featured
                          </Badge>
                        ) : (
                          <Badge variant="secondary">—</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-foreground text-sm">
                        {tool.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`font-mono text-[10px] uppercase tracking-wider ${typeColor} border-transparent text-white`}
                          variant="outline"
                        >
                          {typeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate font-mono text-muted-foreground text-xs">
                        {endpoint}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {tool.totalQueries}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <VerifyButton
                          isVerified={tool.isVerified}
                          toolId={tool.id}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
