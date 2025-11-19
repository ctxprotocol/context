"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { verifyAITool } from "@/lib/db/queries";

const ADMIN_EMAILS = ["alex.r.macleod@gmail.com", "dev+blocknative-http@context.local"];

export async function verifyToolAction(toolId: string) {
  const session = await auth();
  const userEmail = session?.user?.email || "";

  if (!session?.user || !ADMIN_EMAILS.includes(userEmail)) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await verifyAITool({
      toolId,
      verifiedBy: session.user.id,
    });
    revalidatePath("/admin/tools");
    return { success: true };
  } catch (error) {
    console.error("Verification failed:", error);
    return { success: false, error: "Database error" };
  }
}

