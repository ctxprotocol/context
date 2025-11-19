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
  endpoint: z.string().url(),
  price: z.string().regex(/^\d+\.?\d*$/),
  developerWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Wallet must be a valid EVM address"),
  defaultParams: z.string().optional(),
});

export const contributeFormInitialState: ContributeFormState = {
  status: "idle",
};


