import { auth } from "@/app/(auth)/auth";
import { generateApiKey } from "@/lib/api/auth";
import {
  countApiKeysByUserId,
  createApiKey,
  deleteApiKey,
  getApiKeysByUserId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const MAX_KEYS_PER_USER = 5;

/**
 * GET /api/v1/keys
 * List all API keys for the authenticated user
 */
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const keys = await getApiKeysByUserId(session.user.id);

    return Response.json({
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        createdAt: k.createdAt?.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("[api/v1/keys] Failed to list keys:", error);
    return Response.json({ error: "Failed to list API keys" }, { status: 500 });
  }
}

/**
 * POST /api/v1/keys
 * Create a new API key
 * Body: { name: string }
 * Returns: { key: string, id: string } - key is shown only once!
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  if (name.length > 100) {
    return Response.json(
      { error: "Name must be 100 characters or less" },
      { status: 400 }
    );
  }

  try {
    // Check key limit
    const keyCount = await countApiKeysByUserId(session.user.id);
    if (keyCount >= MAX_KEYS_PER_USER) {
      return Response.json(
        {
          error: `Maximum of ${MAX_KEYS_PER_USER} API keys allowed. Delete an existing key first.`,
        },
        { status: 400 }
      );
    }

    // Generate the key
    const { fullKey, keyHash, keyPrefix } = generateApiKey();

    // Store in database
    const apiKey = await createApiKey({
      userId: session.user.id,
      name: name.trim(),
      keyHash,
      keyPrefix,
    });

    console.log("[api/v1/keys] Created API key:", {
      id: apiKey.id,
      userId: session.user.id,
    });

    return Response.json({
      key: fullKey, // Only time we return the full key!
      id: apiKey.id,
    });
  } catch (error) {
    console.error("[api/v1/keys] Failed to create key:", error);
    return Response.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/keys?id=<key_id>
 * Delete an API key
 */
export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Key ID is required" }, { status: 400 });
  }

  try {
    const deleted = await deleteApiKey({ id, userId: session.user.id });

    if (!deleted) {
      return Response.json(
        { error: "API key not found or already deleted" },
        { status: 404 }
      );
    }

    console.log("[api/v1/keys] Deleted API key:", {
      id,
      userId: session.user.id,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[api/v1/keys] Failed to delete key:", error);
    return Response.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}


