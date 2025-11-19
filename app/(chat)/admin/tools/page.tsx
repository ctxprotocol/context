import { Suspense } from "react";
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
    <div className="container py-10">
      <Card>
        <CardHeader>
          <CardTitle>Admin: Manage Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Endpoint / Module</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Queries</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools.map((tool) => {
                const schema = tool.toolSchema as Record<string, any>;
                const isHttp = schema.kind === "http";
                const endpoint = isHttp 
                  ? (schema.endpoint as string) 
                  : (schema.skill?.module as string);

                return (
                  <TableRow key={tool.id}>
                    <TableCell className="font-medium">{tool.name}</TableCell>
                    <TableCell>
                      <Badge variant={isHttp ? "default" : "secondary"}>
                        {isHttp ? "HTTP" : "Native"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-xs font-mono">
                      {endpoint}
                    </TableCell>
                    <TableCell>
                      {tool.isVerified ? (
                        <Badge className="bg-green-500">Verified</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>{tool.totalQueries}</TableCell>
                    <TableCell>
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
  );
}

