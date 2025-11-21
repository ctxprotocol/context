"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { createAITool, getAIToolsByDeveloper } from "@/lib/db/queries";
import { contributeFormSchema, type ContributeFormState } from "./schema";

export async function submitHttpTool(
  _prevState: ContributeFormState,
  formData: FormData
): Promise<ContributeFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const raw = {
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category") || undefined,
    kind: formData.get("kind") || "http",
    endpoint: formData.get("endpoint"),
    price: formData.get("price"),
    developerWallet: formData.get("developerWallet"),
    defaultParams: formData.get("defaultParams") || undefined,
    outputSchema: formData.get("outputSchema") || undefined,
  };

  // We cast raw to any to satisfy the payload type which expects the validated types,
  // but for repopulating the form string values are actually better.
  const payload = raw as unknown as any;

  const parsed = contributeFormSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors,
      payload,
    };
  }

  // Prevent duplicate tools for the same developer and endpoint/module
  const existingTools = await getAIToolsByDeveloper({
    developerId: session.user.id,
  });

  const normalizedEndpoint =
    typeof parsed.data.endpoint === "string"
      ? parsed.data.endpoint.trim()
      : undefined;

  if (normalizedEndpoint) {
    const isDuplicate = existingTools.some((tool) => {
      const schema = tool.toolSchema as Record<string, unknown> | null;
      if (!schema || typeof schema !== "object") {
        return false;
      }

      const kind = (schema as { kind?: unknown }).kind;

      if (parsed.data.kind === "http" && kind === "http") {
        return (schema as { endpoint?: unknown }).endpoint === normalizedEndpoint;
      }

      if (parsed.data.kind === "skill" && kind === "skill") {
        const skill = (schema as { skill?: { module?: unknown } }).skill;
        return skill && skill.module === normalizedEndpoint;
      }

      return false;
    });

    if (isDuplicate) {
      return {
        status: "error",
        message: "You already have a tool registered with this endpoint/module.",
        fieldErrors: {
          endpoint: "This endpoint or module is already registered.",
        },
        payload,
      };
    }
  }

  let defaultParams: Record<string, unknown> | undefined;
  if (parsed.data.defaultParams) {
    try {
      defaultParams = JSON.parse(parsed.data.defaultParams);
      if (!defaultParams || typeof defaultParams !== "object") {
        throw new Error("defaultParams must be a JSON object");
      }
    } catch (error) {
      return {
        status: "error",
        message: "defaultParams must be valid JSON",
        fieldErrors: { defaultParams: "Enter a valid JSON object" },
        payload,
      };
    }
  }

  let outputSchema: Record<string, unknown> | undefined;
  if (parsed.data.outputSchema) {
    try {
      outputSchema = JSON.parse(parsed.data.outputSchema);
      if (!outputSchema || typeof outputSchema !== "object") {
        throw new Error("outputSchema must be a JSON object");
      }
    } catch (error) {
      return {
        status: "error",
        message: "outputSchema must be valid JSON",
        fieldErrors: { outputSchema: "Enter a valid JSON object" },
        payload,
      };
    }
  }

  const toolSchema =
    parsed.data.kind === "http"
      ? {
          kind: "http",
          endpoint: parsed.data.endpoint,
          defaultParams,
          outputSchema,
        }
      : {
          kind: "skill",
          skill: {
            module: parsed.data.endpoint,
          },
          defaultParams,
          // Native skills have output schema in code
        };

  if (parsed.data.kind === "http" && parsed.data.endpoint) {
    try {
      const res = await fetch(parsed.data.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: defaultParams || {},
          context: {
            chatId: "00000000-0000-0000-0000-000000000000",
            requestId: "verify-endpoint",
            userId: session.user.id,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        return {
          status: "error",
          message: `Endpoint verification failed (${res.status}): ${text.slice(
            0,
            100
          )}`,
          fieldErrors: { endpoint: "Endpoint returned an error" },
          payload,
        };
      }
    } catch (err) {
      return {
        status: "error",
        message:
          "Could not reach endpoint. Please ensure it is publicly accessible.",
        fieldErrors: { endpoint: "Connection failed" },
        payload,
      };
    }
  }

  await createAITool({
    name: parsed.data.name,
    description: parsed.data.description,
    developerId: session.user.id,
    developerWallet: parsed.data.developerWallet,
    pricePerQuery: parsed.data.price,
    category: parsed.data.category,
    apiEndpoint: "/api/tools/execute",
    toolSchema,
  });

  revalidatePath("/chat");

  return {
    status: "success",
    message: "Tool submitted! It will appear in the sidebar shortly.",
    // No payload returned on success, form clears naturally
  };
}
