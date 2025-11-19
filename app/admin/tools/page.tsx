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

export default async function AdminToolsPage() {
  const session = await auth();
  
  // Simple check: if not logged in, bounce them.
  // Real app needs robust Role-Based Access Control (RBAC).
  if (!session?.user) {
    redirect("/login");
  }

  const tools = await getAdminTools();

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Tool Administration</h1>
      <div className="rounded-md border">
        <Table>
          <TableCaption>A list of all submitted tools.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Endpoint / Module</TableHead>
              <TableHead>Developer</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tools.map(({ tool, developerEmail }) => (
              <ToolRow key={tool.id} tool={tool} developerEmail={developerEmail} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

