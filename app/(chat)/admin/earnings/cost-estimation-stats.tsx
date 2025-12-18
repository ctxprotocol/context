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
import {
  getAllFlowMultipliers,
  getCostEstimationStats,
} from "@/lib/ai/cost-estimation";

export async function CostEstimationStats() {
  const [stats, multipliers] = await Promise.all([
    getCostEstimationStats(),
    getAllFlowMultipliers(),
  ]);

  return (
    <>
      {/* Cost Estimation Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cost Estimation Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No cost history data yet. Start using convenience tier to see
              stats.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Flow Type</TableHead>
                  <TableHead className="text-right">Queries</TableHead>
                  <TableHead className="text-right">Avg Estimated</TableHead>
                  <TableHead className="text-right">Avg Actual</TableHead>
                  <TableHead className="text-right">Avg Delta</TableHead>
                  <TableHead className="text-right">Avg AI Calls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((s, i) => {
                  const avgDelta = Number(s.avgDelta ?? 0);
                  const isOvercharging = avgDelta < 0;
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">
                        {s.modelId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.flowType}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(s.totalQueries)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${Number(s.avgEstimated ?? 0).toFixed(6)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${Number(s.avgActual ?? 0).toFixed(6)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${isOvercharging ? "text-green-600" : "text-red-600"}`}
                      >
                        {isOvercharging ? "" : "+"}$
                        {Math.abs(avgDelta).toFixed(6)}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(s.avgAiCalls ?? 0).toFixed(1)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Learned Multipliers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Learned Flow Multipliers</CardTitle>
        </CardHeader>
        <CardContent>
          {multipliers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No multipliers learned yet. Using defaults.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Flow Type</TableHead>
                  <TableHead className="text-right">Multiplier</TableHead>
                  <TableHead className="text-right">Sample Count</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {multipliers.map((m) => {
                  const sampleCount = m.sampleCount;
                  const confidence =
                    sampleCount >= 10
                      ? "high"
                      : sampleCount > 0
                        ? "low"
                        : "default";
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">
                        {m.modelId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.flowType}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(m.multiplier).toFixed(4)}x
                      </TableCell>
                      <TableCell className="text-right">
                        {sampleCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            confidence === "high"
                              ? "default"
                              : confidence === "low"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {confidence}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="mt-4 text-muted-foreground text-xs">
            Multipliers are learned via exponential moving average. High
            confidence requires 10+ samples.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
