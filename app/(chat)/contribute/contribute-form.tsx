"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitHttpTool } from "./actions";
import { contributeFormInitialState } from "./schema";

export function ContributeForm({
  developerWallet,
}: {
  developerWallet: string;
}) {
  const [state, formAction] = useFormState(
    submitHttpTool,
    contributeFormInitialState
  );
  const [kind, setKind] = useState("http");

  return (
    <form action={formAction}>
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Tool details</CardTitle>
          <CardDescription>
            Everything will be reviewed automatically. Be descriptive so users
            understand the value of your data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              defaultValue=""
              id="name"
              name="name"
              placeholder="Blocknative Gas (HTTP)"
              required
            />
            <FieldError message={state.fieldErrors?.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              maxLength={1000}
              name="description"
              placeholder="Fetch real-time gas prices, supported chains, or oracle metadata. Supports 'gas_price', 'chains', and 'oracles' endpoints."
              required
              rows={4}
            />
            <p className="text-muted-foreground text-xs">
              This is the <strong>Instruction Manual</strong> for both the AI
              Agent and the User. Be extremely specific about <em>when</em> to
              use this tool and <em>how</em> to use its parameters.
            </p>
            <FieldError message={state.fieldErrors?.description} />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <RadioGroup
              className="flex flex-row gap-4"
              defaultValue="http"
              name="kind"
              onValueChange={setKind}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="kind-http" value="http" />
                <Label htmlFor="kind-http">HTTP Tool (External API)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="kind-skill" value="skill" />
                <Label htmlFor="kind-skill">
                  Native Skill (Internal Module)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select name="category">
                <SelectTrigger className="h-10 px-3 text-sm">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem className="text-sm" value="Network">
                    Network (Gas, RPC, Nodes)
                  </SelectItem>
                  <SelectItem className="text-sm" value="Actions">
                    Actions (Swaps, Lending, Execution)
                  </SelectItem>
                  <SelectItem className="text-sm" value="Market Data">
                    Market Data (Crypto, Stocks, Forex)
                  </SelectItem>
                  <SelectItem className="text-sm" value="Real World">
                    Real World (Weather, Sports, News)
                  </SelectItem>
                  <SelectItem className="text-sm" value="Social">
                    Social (Identity, Governance)
                  </SelectItem>
                  <SelectItem className="text-sm" value="Utility">
                    Utility (Search, Compute)
                  </SelectItem>
                  <SelectItem className="text-sm" value="Other">
                    Other
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price per query (USDC)</Label>
              <Input
                defaultValue="0.01"
                id="price"
                min="0"
                name="price"
                required
                step="0.0001"
                type="number"
              />
              <FieldError message={state.fieldErrors?.price} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endpoint">
              {kind === "http" ? "HTTP Endpoint" : "Module Path"}
            </Label>
            <Input
              id="endpoint"
              name="endpoint"
              placeholder={
                kind === "http"
                  ? "https://your-domain.com/context/blocknative"
                  : "@/lib/ai/skills/community/my-skill"
              }
              required
              type={kind === "http" ? "url" : "text"}
            />
            {kind === "skill" && (
              <p className="text-muted-foreground text-xs">
                Must match the path in your Pull Request (e.g.
                @/lib/ai/skills/community/...). We will automatically read the
                source code to understand how to use it.
              </p>
            )}
            <FieldError message={state.fieldErrors?.endpoint} />
          </div>

          {kind === "http" && (
            <div className="space-y-2">
              <Label htmlFor="defaultParams">Example input (JSON)</Label>
              <Textarea
                className="font-mono text-xs"
                id="defaultParams"
                name="defaultParams"
                placeholder={`{
  "endpoint": "gas_price",
  "chainId": 8453,
  "confidence": 99
}`}
                rows={5}
              />
              <FieldError message={state.fieldErrors?.defaultParams} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="developerWallet">Developer wallet</Label>
            <Input
              defaultValue={developerWallet}
              id="developerWallet"
              name="developerWallet"
              placeholder="0x..."
              required
            />
            <FieldError message={state.fieldErrors?.developerWallet} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-muted-foreground text-sm">
            On-chain payments are routed automatically via ContextRouter.
          </div>
          <Button className="w-full md:w-auto" type="submit">
            Submit tool
          </Button>
        </CardFooter>
        {state.message && (
          <div
            className={`border-t px-6 py-3 text-sm ${
              state.status === "success"
                ? "text-emerald-600"
                : "text-destructive"
            }`}
          >
            {state.message}
          </div>
        )}
      </Card>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-destructive text-sm">{message}</p>;
}
