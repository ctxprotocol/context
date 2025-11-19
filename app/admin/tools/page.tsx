import { auth } from "@/app/(auth)/auth";
import { getAdminTools } from "@/lib/db/admin-queries";
import { redirect } from "next/navigation";
import { ToolRow } from "./tool-row";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default async function AdminToolsPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  const tools = await getAdminTools();

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
            <CardDescription>
              Review pending tools and skills from contributors.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/50">
                  <TableHead className="w-[100px] pl-6">Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="max-w-[300px]">Endpoint / Module</TableHead>
                  <TableHead>Developer</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No tools submitted yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  tools.map(({ tool, developerEmail }) => (
                    <ToolRow key={tool.id} tool={tool} developerEmail={developerEmail} />
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

