import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDisputes } from "@/lib/db/queries";
import { AdminNav } from "../admin-nav";
import { DisputeRow } from "./dispute-row";

const ADMIN_EMAILS = ["alex.r.macleod@gmail.com"];

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const userEmail = session?.user?.email || "";

  if (!session?.user || !ADMIN_EMAILS.includes(userEmail)) {
    return redirect("/");
  }

  const params = await searchParams;
  const verdict =
    (params.verdict as "pending" | "guilty" | "innocent" | "manual_review") ||
    undefined;
  const reason = (params.reason as string) || undefined;
  const limit = 50;
  const offset = 0; // TODO: Implement pagination controls

  const { disputes, total } = await getDisputes({
    verdict,
    reason,
    limit,
    offset,
  });

  return (
    <div className="flex min-h-svh flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-6xl space-y-6">
        <AdminNav />
        <div className="flex items-end justify-between space-y-2">
          <div>
            <h1 className="font-semibold text-3xl tracking-tight">
              Dispute Resolution
            </h1>
            <p className="text-muted-foreground text-sm">
              Adjudicate fraud reports and manage slashing.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/disputes?verdict=pending">
              <Button
                size="sm"
                variant={verdict === "pending" ? "default" : "outline"}
              >
                Pending
              </Button>
            </Link>
            <Link href="/admin/disputes?verdict=guilty">
              <Button
                size="sm"
                variant={verdict === "guilty" ? "default" : "outline"}
              >
                Guilty
              </Button>
            </Link>
            <Link href="/admin/disputes?verdict=innocent">
              <Button
                size="sm"
                variant={verdict === "innocent" ? "default" : "outline"}
              >
                Innocent
              </Button>
            </Link>
            <Link href="/admin/disputes">
              <Button size="sm" variant={verdict ? "outline" : "default"}>
                All
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
            <CardTitle className="font-medium text-base">
              Disputes ({total})
            </CardTitle>
            {verdict && (
              <Badge className="capitalize" variant="secondary">
                {verdict}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 border-b hover:bg-transparent">
                  <TableHead className="w-[200px] pl-6">Tool / Tx</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead className="w-[250px]">Details</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-24 text-center" colSpan={6}>
                      No disputes found.
                    </TableCell>
                  </TableRow>
                ) : (
                  disputes.map((dispute) => (
                    <DisputeRow dispute={dispute} key={dispute.id} />
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
