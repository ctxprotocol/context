import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getActiveAITools } from "@/lib/db/queries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifyButton } from "./verify-button";

const ADMIN_EMAILS = ["alex.r.macleod@gmail.com", "dev+blocknative-http@context.local"];

export default async function AdminToolsPage() {
  const session = await auth();
  const userEmail = session?.user?.email || "";

  if (!session?.user || !ADMIN_EMAILS.includes(userEmail)) {
    return redirect("/");
  }

  const tools = await getActiveAITools();

  return (
    <div className="flex min-h-svh flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">
            Tool Administration
          </h1>
          <p className="text-muted-foreground text-sm">
            Verify, monitor, and manage marketplace submissions.
          </p>
        </div>

      <Card>
          <CardHeader className="px-6 py-4 border-b">
            <CardTitle className="text-base font-medium">Submissions</CardTitle>
        </CardHeader>
          <CardContent className="p-0">
          <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/50">
                  <TableHead className="w-[150px] pl-6">Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                  <TableHead className="max-w-[300px]">Endpoint / Module</TableHead>
                <TableHead>Queries</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools.map((tool) => {
                const schema = tool.toolSchema as Record<string, unknown>;
                const kind = schema?.kind as string | undefined;
                const isMcp = kind === "mcp";
                const isSkill = kind === "skill";
                const endpoint = isMcp 
                  ? (schema.endpoint as string) 
                  : isSkill
                    ? ((schema.skill as Record<string, unknown>)?.module as string)
                    : "Unknown";

                const typeLabel = isMcp ? "MCP" : isSkill ? "Native" : "Unknown";
                const typeColor = isMcp ? "bg-blue-600" : isSkill ? "bg-purple-600" : "bg-gray-600";

                return (
                    <TableRow key={tool.id} className="hover:bg-muted/50 border-b border-border/50 last:border-none">
                      <TableCell className="pl-6">
                        {tool.isVerified ? (
                          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600/90 border-transparent text-white shadow-sm">Verified</Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-sm text-foreground">{tool.name}</TableCell>
                    <TableCell>
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-wider ${typeColor} text-white border-transparent`}>
                        {typeLabel}
                      </Badge>
                    </TableCell>
                      <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground font-mono">
                      {endpoint}
                    </TableCell>
                      <TableCell className="text-sm font-mono">{tool.totalQueries}</TableCell>
                      <TableCell className="text-right pr-6">
                      <VerifyButton toolId={tool.id} isVerified={tool.isVerified} />
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
