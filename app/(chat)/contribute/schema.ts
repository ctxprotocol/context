import { z } from "zod";

export type ContributeFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const contributeFormSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  category: z.string().optional(),
  kind: z.enum(["http", "skill"]).default("http"),
  endpoint: z.string().min(1).optional(), // URL for http, module path for skill
  price: z.string().regex(/^\d+\.?\d*$/),
  developerWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Wallet must be a valid EVM address"),
  defaultParams: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.kind === "http") {
    if (!data.endpoint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Endpoint URL is required for HTTP tools",
        path: ["endpoint"],
      });
    } else if (!z.string().url().safeParse(data.endpoint).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a valid URL",
        path: ["endpoint"],
      });
    }
  } else {
    if (!data.endpoint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Module path is required for Native Skills",
        path: ["endpoint"],
      });
    } else if (!data.endpoint.startsWith("@/")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Module path must start with @/ (e.g. @/lib/ai/skills/community/...)",
        path: ["endpoint"],
      });
    }
  }
});

export const contributeFormInitialState: ContributeFormState = {
  status: "idle",
};


