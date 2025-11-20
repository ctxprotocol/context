"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
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
import { cn } from "@/lib/utils";
import { submitHttpTool } from "./actions";
import { contributeFormInitialState } from "./schema";

export function ContributeForm({
  developerWallet,
}: {
  developerWallet: string;
}) {
  const [state, formAction, isPending] = useActionState(
    submitHttpTool,
    contributeFormInitialState
  );
  const [kind, setKind] = useState("http");

  const nameError = state.fieldErrors?.name;
  const descriptionError = state.fieldErrors?.description;
  const categoryError = state.fieldErrors?.category;
  const priceError = state.fieldErrors?.price;
  const endpointError = state.fieldErrors?.endpoint;
  const defaultParamsError = state.fieldErrors?.defaultParams;
  const developerWalletError = state.fieldErrors?.developerWallet;

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
              aria-invalid={nameError ? true : undefined}
              className={cn(
                nameError && "border-destructive focus-visible:ring-destructive"
              )}
              defaultValue={state.payload?.name || ""}
              id="name"
              name="name"
              placeholder="Blocknative Gas (HTTP)"
            />
            <FieldError message={nameError} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              aria-invalid={descriptionError ? true : undefined}
              className={cn(
                descriptionError &&
                  "border-destructive focus-visible:ring-destructive"
              )}
              defaultValue={state.payload?.description || ""}
              id="description"
              maxLength={1000}
              name="description"
              placeholder="Fetch real-time gas prices, supported chains, or oracle metadata. Supports 'gas_price', 'chains', and 'oracles' endpoints."
              rows={4}
            />
            <p className="text-muted-foreground text-xs">
              This is the <strong>Instruction Manual</strong> for both the AI
              Agent and the User. Be extremely specific about <em>when</em> to
              use this tool and <em>how</em> to use its parameters.
            </p>
            <FieldError message={descriptionError} />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <RadioGroup
              className="flex flex-row gap-4"
              defaultValue={state.payload?.kind || "http"}
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
              <Select
                defaultValue={state.payload?.category || ""}
                name="category"
              >
                <SelectTrigger
                  aria-invalid={categoryError ? true : undefined}
                  className={cn(
                    "h-10 px-3 text-sm",
                    categoryError &&
                      "border-destructive focus-visible:ring-destructive"
                  )}
                >
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
              <FieldError message={categoryError} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price per query (USDC)</Label>
              <Input
                aria-invalid={priceError ? true : undefined}
                className={cn(
                  priceError &&
                    "border-destructive focus-visible:ring-destructive"
                )}
                defaultValue={state.payload?.price || "0.01"}
                id="price"
                min="0"
                name="price"
                step="0.0001"
                type="number"
              />
              <FieldError message={priceError} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endpoint">
              {kind === "http" ? "HTTP Endpoint" : "Module Path"}
            </Label>
            <Input
              aria-invalid={endpointError ? true : undefined}
              className={cn(
                endpointError &&
                  "border-destructive focus-visible:ring-destructive"
              )}
              defaultValue={state.payload?.endpoint || ""}
              id="endpoint"
              name="endpoint"
              placeholder={
                kind === "http"
                  ? "https://your-domain.com/context/blocknative"
                  : "@/lib/ai/skills/community/my-skill"
              }
              type={kind === "http" ? "url" : "text"}
            />
            {kind === "skill" && (
              <p className="text-muted-foreground text-xs">
                Must match the path in your Pull Request (e.g.
                @/lib/ai/skills/community/...). We will automatically read the
                source code to understand how to use it.
              </p>
            )}
            <FieldError message={endpointError} />
          </div>

          {kind === "http" && (
            <div className="space-y-2">
              <Label htmlFor="defaultParams">Example input (JSON)</Label>
              <Textarea
                className="font-mono text-xs"
                defaultValue={state.payload?.defaultParams || ""}
                id="defaultParams"
                name="defaultParams"
                placeholder={`{
  "endpoint": "gas_price",
  "chainId": 8453,
  "confidence": 99
}`}
                rows={5}
              />
              <FieldError message={defaultParamsError} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="developerWallet">Developer wallet</Label>
            <Input
              aria-invalid={developerWalletError ? true : undefined}
              className={cn(
                "bg-muted",
                developerWalletError &&
                  "border-destructive focus-visible:ring-destructive"
              )}
              aria-readonly="true"
              defaultValue={developerWallet}
              id="developerWallet"
              name="developerWallet"
              placeholder="0x..."
              readOnly
            />
            <FieldError message={developerWalletError} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-muted-foreground text-sm">
            On-chain payments are routed automatically via ContextRouter.
          </div>
          <Button
            className="w-full md:w-auto"
            disabled={isPending}
            type="submit"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit tool"
            )}
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
