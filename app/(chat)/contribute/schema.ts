import { z } from "zod";

export type ContributeFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  payload?: Partial<z.infer<typeof contributeFormSchema>>;
};

export const contributeFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().min(1, "Description is required").max(5000),
  category: z.string().min(1, "Category is required"),
  endpoint: z
    .string()
    .min(1, "MCP endpoint URL is required")
    .url("Must be a valid URL")
    .refine(
      (url) => {
        // Allow http://localhost in development for testing
        if (process.env.NODE_ENV === "development") {
          const isLocalhost =
            url.startsWith("http://localhost") ||
            url.startsWith("http://127.0.0.1");
          if (isLocalhost) {
            return true;
          }
        }
        // Otherwise, require HTTPS
        return url.startsWith("https://");
      },
      {
        message: "Endpoint must use HTTPS for security",
      }
    ),
  price: z
    .string()
    .regex(/^\d+\.?\d{0,4}$/, "Max 4 decimal places allowed")
    .refine((value) => Number(value) >= 0, {
      message: "Price must be 0 or greater",
    })
    .refine((value) => Number(value) <= 100, {
      message: "Price cannot exceed $100 per query",
    }),
  developerWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Wallet must be a valid EVM address"),
});

export const contributeFormInitialState: ContributeFormState = {
  status: "idle",
};
