"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { toggleToolVerification } from "@/lib/db/admin-queries";

export async function verifyToolAction(toolId: string, isVerified: boolean) {
  const session = await auth();
  
  // TODO: Add real admin check here (e.g. whitelist specific emails)
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  await toggleToolVerification(toolId, isVerified);
  revalidatePath("/admin/tools");
}

