import { z } from "zod";

export type ContributeFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  payload?: Partial<z.infer<typeof contributeFormSchema>>;
};

export const contributeFormSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(255),
    description: z.string().min(1, "Description is required").max(5000),
    category: z.string().min(1, "Category is required"),
    kind: z.enum(["mcp", "skill"]).default("mcp"),
    endpoint: z.string().min(1).optional(), // URL for mcp, module path for skill
    price: z
      .string()
      .regex(/^\d+\.?\d*$/, "Enter a valid number")
      .refine((value) => Number(value) >= 0, {
        message: "Price must be 0 or greater",
      }),
    developerWallet: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Wallet must be a valid EVM address"),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "mcp") {
      // MCP Server validation
      if (!data.endpoint) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "MCP endpoint URL is required",
          path: ["endpoint"],
        });
      } else if (!z.string().url().safeParse(data.endpoint).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Must be a valid URL",
          path: ["endpoint"],
        });
      }
    } else if (data.kind === "skill") {
      // Native skill validation
      if (!data.endpoint) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Module path is required for Native Skills",
          path: ["endpoint"],
        });
      } else if (!data.endpoint.startsWith("@/")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Module path must start with @/ (e.g. @/lib/ai/skills/community/...)",
          path: ["endpoint"],
        });
      }
    }
  });

export const contributeFormInitialState: ContributeFormState = {
  status: "idle",
};
