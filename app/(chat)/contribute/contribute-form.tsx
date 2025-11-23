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
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import { cn } from "@/lib/utils";
import { submitHttpTool } from "./actions";
import { contributeFormInitialState } from "./schema";

export function ContributeForm() {
  const [state, formAction, isPending] = useActionState(
    submitHttpTool,
    contributeFormInitialState
  );
  const [kind, setKind] = useState("http");
  const { activeWallet } = useWalletIdentity();
  const walletAddress = activeWallet?.address;
  const isConnected = !!walletAddress;

  const nameError = state.fieldErrors?.name;
  const descriptionError = state.fieldErrors?.description;
  const categoryError = state.fieldErrors?.category;
  const priceError = state.fieldErrors?.price;
  const endpointError = state.fieldErrors?.endpoint;
  const defaultParamsError = state.fieldErrors?.defaultParams;
  const outputSchemaError = state.fieldErrors?.outputSchema;
  const developerWalletError = state.fieldErrors?.developerWallet;

  const connectedWallet = walletAddress || "";

  const httpDescriptionPlaceholder = `Fetch real-time gas prices, supported chains, or oracle metadata.

Endpoints:
- "chains": Returns valid chainIds, systems, and networks. Call this first to resolve names (e.g. "Base") to IDs.
- "gas_price": Requires "chainId" (from "chains"). Optional: "confidence" (1-99).
- "oracles": Requires "chainId" OR ("system" + "network"). Use "chains" to find these.

Call budget:
- Each paid query may call this HTTP tool at most 10 times.
- Typical pattern:
  1. Call "chains" once to get all supported chains.
  2. Then make up to 9 additional calls to "gas_price" or "oracles".
- Never loop over every chain. If the user asks for "top 3" or a summary across many chains,
  choose a small subset (e.g. 3–10 major L2s) and work within the 10-call budget.

Example intent:
- "Gas on Base" -> 1. Call "chains" -> find Base is chainId 8453 -> 2. Call "gas_price" with chainId=8453.`;

  const skillDescriptionPlaceholder = `This module exports functions to interact with Blocknative data.

Exports:
- getGasPrice({ chainId, confidence }): Returns gas estimates.
- getChains(): Returns list of supported networks.
- getOracles({ chainId, system, network }): Returns oracle data.

Usage:
The agent will automatically import this module and call the appropriate function based on the user's request.
Use 'getChains' to resolve network names to chain IDs first, and design workflows so that each paid query makes
no more than 10 total HTTP calls (e.g. 1 discovery call + a small number of detailed lookups).`;

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
              placeholder="Blocknative Gas"
            />
            <FieldError message={nameError} />
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
              placeholder={
                kind === "http"
                  ? httpDescriptionPlaceholder
                  : skillDescriptionPlaceholder
              }
              rows={kind === "http" ? 20 : 15}
            />
            <p className="text-muted-foreground text-xs">
              This is the <strong>Instruction Manual</strong> for both the AI
              Agent and the User. Be extremely specific about <em>when</em> to
              use this tool and <em>how</em> to use its parameters.
            </p>
            <FieldError message={descriptionError} />
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
              <p className="text-muted-foreground text-xs leading-relaxed">
                Provide a valid JSON object representing a typical request.
                Include common parameters like <code>chainId</code> or{" "}
                <code>network</code> to guide the AI.
              </p>
              <FieldError message={defaultParamsError} />
            </div>
          )}

          {kind === "http" && (
            <div className="space-y-2">
              <Label htmlFor="outputSchema">Example Output (JSON)</Label>
              <Textarea
                className="font-mono text-xs"
                defaultValue={state.payload?.outputSchema || ""}
                id="outputSchema"
                name="outputSchema"
                placeholder={`{
  "data": {
    "estimates": [
      { "confidence": 99, "maxFeePerGasGwei": 0.1 }
    ],
    "chains": [
      { "chainId": 1, "network": "mainnet" }
    ],
    "oracles": [
      { "name": "Chainlink", "system": "ethereum" }
    ]
  }
}`}
                rows={8}
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong>CRITICAL:</strong> Provide a precise, real-world example
                of your API's JSON response. The AI Agent uses this schema to
                write code that parses your data. If this example is inaccurate,
                the agent will guess the structure and likely fail to retrieve
                data, causing your tool to be rated poorly. Include examples for
                all supported endpoints if possible.
              </p>
              <FieldError message={outputSchemaError} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="developerWallet">Developer wallet</Label>
            <Input
              aria-invalid={developerWalletError ? true : undefined}
              className={cn(
                "cursor-not-allowed bg-muted opacity-50",
                developerWalletError &&
                  "border-destructive focus-visible:ring-destructive"
              )}
              defaultValue=""
              disabled
              id="display-wallet"
              placeholder={
                isConnected
                  ? connectedWallet
                  : "Please connect your wallet to continue"
              }
              value={isConnected ? connectedWallet : ""}
            />
            <input
              name="developerWallet"
              type="hidden"
              value={connectedWallet}
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
            disabled={isPending || !isConnected}
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
