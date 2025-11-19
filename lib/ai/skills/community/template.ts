import type { SkillRuntime } from "../runtime";
import { z } from "zod";

/**
 * Verified Community Skill Template
 * 
 * Instructions:
 * 1. Copy this file to `lib/ai/skills/community/your-skill-name.ts`
 * 2. Define your Input/Output schemas using Zod.
 * 3. Implement the function logic.
 * 4. Export the function.
 * 
 * Note: This code runs in a secure, verified environment on the Context server.
 * You can use fetch, process data, and import standard libraries.
 */

export const mySkillSchema = z.object({
  // Define your parameters here
  query: z.string().describe("The search query"),
});

export type MySkillInput = z.infer<typeof mySkillSchema>;

export async function mySkill(input: MySkillInput) {
  // Access the runtime if needed (e.g. for user session)
  // const runtime = getSkillRuntime();

  // Your logic here
  return {
    message: `Hello from community skill! You said: ${input.query}`,
  };
}

