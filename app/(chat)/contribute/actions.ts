"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { createAITool } from "@/lib/db/queries";
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
    endpoint: formData.get("endpoint"),
    price: formData.get("price"),
    developerWallet: formData.get("developerWallet"),
    defaultParams: formData.get("defaultParams") || undefined,
  };

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
    };
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
    toolSchema: {
      kind: "http",
      endpoint: parsed.data.endpoint,
      defaultParams,
    },
  });

  revalidatePath("/chat");

  return {
    status: "success",
    message: "Tool submitted! It will appear in the sidebar shortly.",
  };
}

