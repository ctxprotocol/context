"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { featureAITool, unfeatureAITool } from "@/lib/db/queries";

const ADMIN_EMAILS = ["alex.r.macleod@gmail.com"];

export async function featureToolAction(toolId: string) {
  const session = await auth();
  const userEmail = session?.user?.email || "";

  if (!session?.user || !ADMIN_EMAILS.includes(userEmail)) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await featureAITool({
      toolId,
      featuredBy: session.user.id,
    });
    revalidatePath("/admin/tools");
    return { success: true };
  } catch (error) {
    console.error("Feature failed:", error);
    return { success: false, error: "Database error" };
  }
}

export async function unfeatureToolAction(toolId: string) {
  const session = await auth();
  const userEmail = session?.user?.email || "";

  if (!session?.user || !ADMIN_EMAILS.includes(userEmail)) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await unfeatureAITool({ toolId });
    revalidatePath("/admin/tools");
    return { success: true };
  } catch (error) {
    console.error("Unfeature failed:", error);
    return { success: false, error: "Database error" };
  }
}
