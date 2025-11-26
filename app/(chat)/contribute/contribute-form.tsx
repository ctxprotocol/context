"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
import { submitTool } from "./actions";
import { contributeFormInitialState } from "./schema";

export function ContributeForm() {
  const [state, formAction, isPending] = useActionState(
    submitTool,
    contributeFormInitialState
  );
  const [kind, setKind] = useState("mcp");
  const { activeWallet } = useWalletIdentity();
  const walletAddress = activeWallet?.address;
  const isConnected = !!walletAddress;

  const nameError = state.fieldErrors?.name;
  const descriptionError = state.fieldErrors?.description;
  const categoryError = state.fieldErrors?.category;
  const priceError = state.fieldErrors?.price;
  const endpointError = state.fieldErrors?.endpoint;
  const developerWalletError = state.fieldErrors?.developerWallet;

  const connectedWallet = walletAddress || "";

  // MCP tools auto-discover schemas via listTools(), so the description
  // focuses on WHAT the server does and WHY users should use it.
  const mcpDescriptionPlaceholder = `What does your MCP server do? (Tool schemas are auto-discovered)

Example:
Real-time gas prices for 50+ EVM chains including Ethereum, Base, Arbitrum, and Optimism. Accurate estimates for fast, standard, and slow transactions. Updated every block.

Agent tips (optional):
- Call list_chains first to discover available networks
- Gas prices returned in Gwei`;

  const skillDescriptionPlaceholder = `Describe the exported functions and how to use them.

Example:
This module exports functions to interact with Uniswap.

Exports:
- getQuote({ tokenIn, tokenOut, amount }): Returns swap quote
- getPoolInfo({ poolAddress }): Returns pool statistics
- listPools({ token }): Returns pools containing a token

Usage:
The agent will import this module and call the appropriate function.
Design workflows to minimize external API calls.`;

  return (
    <form action={formAction}>
      <Card className="border shadow-sm">
        <CardContent className="space-y-4 pt-6">
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
              className="flex flex-col gap-3 sm:flex-row sm:gap-6"
              defaultValue={state.payload?.kind || "mcp"}
              name="kind"
              onValueChange={setKind}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="kind-mcp" value="mcp" />
                <Label className="cursor-pointer" htmlFor="kind-mcp">
                  MCP Server
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="kind-skill" value="skill" />
                <Label className="cursor-pointer" htmlFor="kind-skill">
                  Native Skill
                </Label>
              </div>
            </RadioGroup>
            <p className="text-muted-foreground text-xs">
              {kind === "mcp" ? (
                <>
                  <strong>MCP Server (Recommended):</strong> Build a standard{" "}
                  <a
                    className="underline"
                    href="https://modelcontextprotocol.io"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Model Context Protocol
                  </a>{" "}
                  server and paste your SSE endpoint. Tools are auto-discovered.
                </>
              ) : (
                <>
                  <strong>Native Skill:</strong> High-performance TypeScript
                  module hosted on Context. Requires a{" "}
                  <a
                    className="underline"
                    href="https://github.com/ctxprotocol/context/tree/main/lib/ai/skills/community"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Pull Request
                  </a>
                  .
                </>
              )}
            </p>
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
              maxLength={5000}
              name="description"
              placeholder={
                kind === "mcp"
                  ? mcpDescriptionPlaceholder
                  : skillDescriptionPlaceholder
              }
              rows={kind === "mcp" ? 9 : 13}
            />
            <p className="text-muted-foreground text-xs">
              {kind === "mcp" ? (
                <>
                  Explain what your server does and why users should use it.
                  Tool schemas are <strong>auto-discovered</strong> from your
                  MCP server no need to document parameters here.
                </>
              ) : (
                <>
                  Shown to users in the marketplace and used by the AI to
                  understand your tool. Explain what it does, why it&apos;s
                  valuable, and how to use the exported functions.
                </>
              )}
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
                defaultValue={state.payload?.price || "0.00"}
                id="price"
                max="100"
                min="0"
                name="price"
                step="0.0001"
                type="number"
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Set to <strong>$0.00</strong> for free tools, or charge per
                query (up to 4 decimals, e.g. $0.001). Users pay{" "}
                <strong>once per chat turn</strong>.
              </p>
              <FieldError message={priceError} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endpoint">
              {kind === "mcp" ? "MCP Endpoint (SSE)" : "Module Path"}
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
                kind === "mcp"
                  ? "https://your-mcp-server.com/sse"
                  : "@/lib/ai/skills/community/my-skill"
              }
              type={kind === "mcp" ? "url" : "text"}
            />
            <p className="text-muted-foreground text-xs">
              {kind === "mcp" ? (
                <>
                  Your MCP server&apos;s SSE endpoint. We&apos;ll connect and
                  auto-discover your tools via <code>listTools()</code>.
                </>
              ) : (
                <>
                  Must match the path in your Pull Request (e.g.{" "}
                  <code>@/lib/ai/skills/community/...</code>).
                </>
              )}
            </p>
            <FieldError message={endpointError} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="developerWallet">Developer Wallet</Label>
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
            <p className="text-muted-foreground text-xs">
              Earnings are sent to this wallet on Base.
            </p>
            <FieldError message={developerWalletError} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-muted-foreground text-sm">
            Payments routed via ContextRouter on Base (90% to you, 10% platform
            fee).
          </div>
          <Button
            className="w-full md:w-auto"
            disabled={isPending || !isConnected}
            type="submit"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Submit Tool"
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
