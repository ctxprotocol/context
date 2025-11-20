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
import { Textarea } from "@/components/ui/textarea";
import {
  submitHttpTool,
} from "./actions";
import { contributeFormInitialState } from "./schema";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ContributeForm({ developerWallet }: { developerWallet: string }) {
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
              id="name"
              name="name"
              placeholder="Blocknative Gas (HTTP)"
              required
              defaultValue=""
            />
            <FieldError message={state.fieldErrors?.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Short summary of what your endpoint returns."
              rows={4}
              required
            />
            <FieldError message={state.fieldErrors?.description} />
          </div>
          
          <div className="space-y-2">
            <Label>Type</Label>
            <RadioGroup 
              name="kind" 
              defaultValue="http" 
              onValueChange={setKind}
              className="flex flex-row gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="http" id="kind-http" />
                <Label htmlFor="kind-http">HTTP Tool (External API)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="skill" id="kind-skill" />
                <Label htmlFor="kind-skill">Native Skill (Internal Module)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select name="category">
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Network">Network (Gas, RPC, Nodes)</SelectItem>
                  <SelectItem value="DeFi">DeFi (Swap, Lending, Yield)</SelectItem>
                  <SelectItem value="Data">Data (Prices, Sports, Weather, Analytics)</SelectItem>
                  <SelectItem value="Social">Social (Identity, Social Media, Governance)</SelectItem>
                  <SelectItem value="Utility">Utility (Search, Compute, Automation)</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price per query (USDC)</Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.0001"
                min="0"
                defaultValue="0.01"
                required
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
              type={kind === "http" ? "url" : "text"}
              placeholder={
                kind === "http" 
                  ? "https://your-domain.com/context/blocknative"
                  : "@/lib/ai/skills/community/my-skill"
              }
              required
            />
            {kind === "skill" && (
              <p className="text-xs text-muted-foreground">
                Must match the path in your Pull Request (e.g. @/lib/ai/skills/community/...)
              </p>
            )}
            <FieldError message={state.fieldErrors?.endpoint} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultParams">Example input (JSON)</Label>
            <Textarea
              id="defaultParams"
              name="defaultParams"
              placeholder='{"endpoint":"gas_price","chainId":8453,"confidence":90}'
              rows={4}
            />
            <FieldError message={state.fieldErrors?.defaultParams} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="developerWallet">Developer wallet</Label>
            <Input
              id="developerWallet"
              name="developerWallet"
              placeholder="0x..."
              required
              defaultValue={developerWallet}
            />
            <FieldError message={state.fieldErrors?.developerWallet} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            On-chain payments are routed automatically via ContextRouter.
          </div>
          <Button type="submit" className="w-full md:w-auto">
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
  return <p className="text-sm text-destructive">{message}</p>;
}
