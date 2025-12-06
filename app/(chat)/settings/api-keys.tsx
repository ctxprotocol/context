"use client";

import { AlertCircle, Check, Copy, Key, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LoaderIcon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApiKeyData = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/keys");
      if (response.ok) {
        const data = await response.json();
        setKeys(data.keys);
      }
    } catch (error) {
      console.error("Failed to fetch API keys:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for your API key");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setNewlyCreatedKey(data.key);
        setNewKeyName("");
        await fetchKeys();
        toast.success(
          "API key created! Copy it now - it won't be shown again."
        );
      } else {
        toast.error(data.error || "Failed to create API key");
      }
    } catch (error) {
      toast.error("Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (newlyCreatedKey) {
      await navigator.clipboard.writeText(newlyCreatedKey);
      setCopied(true);
      toast.success("API key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/v1/keys?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("API key deleted");
        await fetchKeys();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete API key");
      }
    } catch (error) {
      toast.error("Failed to delete API key");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      // Reset state when opening dialog fresh
      setNewlyCreatedKey(null);
      setNewKeyName("");
      setCopied(false);
    }
    setDialogOpen(open);
  };

  const handleDialogClose = () => {
    setNewlyCreatedKey(null);
    setCopied(false);
    setDialogOpen(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Key list skeleton */}
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3"
                key={i}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-28 animate-pulse rounded-md bg-muted" />
                    <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-3 w-32 animate-pulse rounded-md bg-muted" />
                    <div className="h-3 w-28 animate-pulse rounded-md bg-muted" />
                  </div>
                </div>
                <div className="size-9 animate-pulse rounded-md bg-muted" />
              </div>
            ))}
          </div>
          {/* Usage section skeleton */}
          <div className="rounded-lg border border-dashed p-4">
            <div className="h-4 w-16 animate-pulse rounded-md bg-muted" />
            <div className="mt-2 h-3 w-72 animate-pulse rounded-md bg-muted" />
            <div className="mt-3 h-20 w-full animate-pulse rounded-md bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Key className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">API Keys</CardTitle>
            <CardDescription>
              Manage API keys for programmatic access to the Context Protocol
            </CardDescription>
          </div>
          <Dialog onOpenChange={handleDialogOpenChange} open={dialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" />
                New Key
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl" hideClose>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription>
                  Generate a new API key for accessing the Context Protocol API.
                </DialogDescription>
              </DialogHeader>

              {newlyCreatedKey ? (
                <div className="flex flex-col gap-4">
                  <Alert>
                    <AlertCircle className="size-4" />
                    <AlertTitle>Save your API key now!</AlertTitle>
                    <AlertDescription>
                      This is the only time you'll see this key. Copy it and
                      store it securely.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-3">
                    <Label>Your new API key</Label>
                    <div className="flex gap-2">
                      <Input
                        className="font-mono text-sm"
                        readOnly
                        value={newlyCreatedKey}
                      />
                      <Button
                        onClick={handleCopy}
                        size="icon"
                        variant="outline"
                      >
                        {copied ? (
                          <Check className="size-4 text-green-500" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <DialogFooter className="mt-2">
                    <DialogClose asChild>
                      <Button onClick={handleDialogClose}>Done</Button>
                    </DialogClose>
                  </DialogFooter>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="space-y-3">
                    <Label htmlFor="keyName">Key Name</Label>
                    <Input
                      id="keyName"
                      onChange={(e) => setNewKeyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreate();
                        }
                      }}
                      placeholder="e.g., Development, Production"
                      value={newKeyName}
                    />
                    <p className="text-muted-foreground text-xs">
                      A friendly name to help you identify this key
                    </p>
                  </div>
                  <DialogFooter className="mt-2">
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button disabled={creating} onClick={handleCreate}>
                      {creating && (
                        <span className="animate-spin">
                          <LoaderIcon size={16} />
                        </span>
                      )}
                      Create Key
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {keys.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center">
            <Key className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-2 text-muted-foreground text-sm">
              No API keys yet. Create one to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3"
                key={key.id}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{key.name}</span>
                    <Badge className="font-mono text-xs" variant="outline">
                      {key.keyPrefix}...
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground text-xs">
                    <span>Created {formatDate(key.createdAt)}</span>
                    <span>Last used: {formatDate(key.lastUsedAt)}</span>
                  </div>
                </div>
                <Button
                  disabled={deletingId === key.id}
                  onClick={() => handleDelete(key.id)}
                  size="icon"
                  variant="ghost"
                >
                  {deletingId === key.id ? (
                    <span className="animate-spin">
                      <LoaderIcon size={16} />
                    </span>
                  ) : (
                    <Trash2 className="size-4 text-destructive" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-dashed p-4">
          <h4 className="mb-2 font-medium text-sm">Usage</h4>
          <p className="mb-3 text-muted-foreground text-xs">
            Use your API key to authenticate requests to the Context Protocol
            API:
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            <code>{`curl -X POST ${process.env.NEXT_PUBLIC_APP_URL || "https://ctxprotocol.com"}/api/v1/tools/execute \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"toolId": "...", "args": {...}}'`}</code>
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
