"use client";

import { ExternalLink, Github, Package, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { LoaderIcon } from "@/components/icons";
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
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    submitTool,
    contributeFormInitialState
  );
  const { activeWallet } = useWalletIdentity();
  const walletAddress = activeWallet?.address;
  const isConnected = !!walletAddress;

  // Redirect to developer tools after showing success message
  useEffect(() => {
    if (state.status === "success") {
      const timer = setTimeout(() => {
        router.push("/developer/tools");
      }, 2000); // Show message for 2 seconds then redirect
      return () => clearTimeout(timer);
    }
  }, [state.status, router]);

  // Track price for dynamic helper text (Free vs Paid)
  const [price, setPrice] = useState(state.payload?.price || "0.00");
  const priceValue = Number.parseFloat(price) || 0;

  const nameError = state.fieldErrors?.name;
  const descriptionError = state.fieldErrors?.description;
  const categoryError = state.fieldErrors?.category;
  const priceError = state.fieldErrors?.price;
  const endpointError = state.fieldErrors?.endpoint;
  const developerWalletError = state.fieldErrors?.developerWallet;

  const connectedWallet = walletAddress || "";

  const descriptionPlaceholder = `Real-time gas prices for 50+ EVM chains including Ethereum, Base, Arbitrum, and Optimism.

Features:
- Gas estimates at multiple confidence levels (70-99%)
- EIP-1559 support (maxFeePerGas, maxPriorityFeePerGas)
- Estimated confirmation times in seconds

Agent tips:
- Call list_chains first to get all supported chainIds
- Gas prices returned in Gwei with confidence levels`;

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>Submit a Tool</CardTitle>
          <CardDescription>
            Publish your MCP server to the Context Marketplace. Earn USDC when
            agents use your tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
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

          <div className="space-y-3">
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
              placeholder={descriptionPlaceholder}
              rows={9}
            />
            <p className="text-muted-foreground text-xs">
              Explain what your MCP Tool does and why users should use it.
              Skills are <strong>auto-discovered</strong> from your MCP server.
              See{" "}
              <a
                className="underline"
                href="https://github.com/ctxprotocol/context#-the-data-broker-standard"
                rel="noopener noreferrer"
                target="_blank"
              >
                The Data Broker Standard
              </a>{" "}
              for <code>outputSchema</code> requirements and dispute resolution.
            </p>
            <FieldError message={descriptionError} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
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
            <div className="space-y-3">
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
                onChange={(e) => setPrice(e.target.value)}
                step="0.0001"
                type="number"
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Set to <strong>$0.00</strong> for free tools, or charge per
                query (up to 4 decimals, e.g. $0.001). Users pay{" "}
                <strong>once per chat turn</strong>.
              </p>
              {priceValue > 0 ? (
                <p className="text-emerald-600 text-xs leading-relaxed dark:text-emerald-500">
                  <strong>Business in a Box</strong> — Add{" "}
                  <code className="rounded bg-emerald-500/10 px-1 py-0.5">
                    createContextMiddleware()
                  </code>{" "}
                  to enable payments. We handle billing and users.{" "}
                  <a
                    className="underline"
                    href="https://github.com/ctxprotocol/sdk#-securing-your-tool"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    1-line setup →
                  </a>
                </p>
              ) : (
                <p className="text-muted-foreground/70 text-xs leading-relaxed">
                  Free tools work out of the box. Add middleware later to
                  monetize.
                </p>
              )}
              <FieldError message={priceError} />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2 dark:bg-amber-500/15">
            <Shield className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
            <div className="space-y-1 text-amber-600/90 text-xs dark:text-amber-500/90">
              <p className="leading-relaxed">
                Stake <strong>$10.00 USDC (minimum stake)</strong> from your
                smart wallet after submission. Your tool will auto-activate once
                staked. Fully refundable with 7-day withdrawal delay.
              </p>
              <p className="leading-relaxed">
                All tools require a minimum $10.00 stake to ensure quality and
                prevent spam. Enforced on-chain.
              </p>
              <Link
                className="inline-flex items-center gap-1 font-medium hover:underline"
                href="/developer/tools"
              >
                Manage stakes in Developer Tools
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="endpoint">MCP Endpoint</Label>
            <Input
              aria-invalid={endpointError ? true : undefined}
              className={cn(
                endpointError &&
                  "border-destructive focus-visible:ring-destructive"
              )}
              defaultValue={state.payload?.endpoint || ""}
              id="endpoint"
              name="endpoint"
              placeholder="https://your-mcp-server.com/sse or /mcp"
              type="url"
            />
            <p className="text-muted-foreground text-xs">
              Your MCP server endpoint (<strong>HTTPS required</strong>). We
              support both <strong>HTTP Streaming</strong> (<code>/mcp</code>)
              and <strong>SSE</strong> (<code>/sse</code>) transports.
              We&apos;ll auto-discover your skills via <code>listTools()</code>.
              See{" "}
              <a
                className="underline"
                href="https://github.com/ctxprotocol/context/tree/main/examples/blocknative-contributor"
                rel="noopener noreferrer"
                target="_blank"
              >
                example server
              </a>
              .
            </p>
            <FieldError message={endpointError} />
          </div>

          <div className="space-y-3">
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
                <span className="animate-spin">
                  <LoaderIcon size={16} />
                </span>
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

      {/* Developer Resources */}
      <div className="relative my-10">
        <div aria-hidden="true" className="absolute inset-0 flex items-center">
          <div className="w-full border-border border-t" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-2 text-muted-foreground text-sm">
            Developer Resources
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <a
          className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-ring/20 hover:shadow-md"
          href="https://github.com/ctxprotocol/context"
          rel="noopener noreferrer"
          target="_blank"
        >
          <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <Github className="size-5" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">ctxprotocol/context</h3>
            <ExternalLink className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            The open-source marketplace platform. Contains the web app, smart
            contracts, and payment infrastructure.
          </p>
        </a>

        <a
          className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-ring/20 hover:shadow-md"
          href="https://github.com/ctxprotocol/sdk"
          rel="noopener noreferrer"
          target="_blank"
        >
          <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <Package className="size-5" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">@ctxprotocol/sdk</h3>
            <ExternalLink className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            The complete Developer Kit. Contains the Client SDK for agents and
            MCP Server examples for tool builders.
          </p>
        </a>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-destructive text-sm">{message}</p>;
}
