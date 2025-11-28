import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const toolInvocationSchema = z.object({
  toolId: z.string().uuid(),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum(["chat-model", "chat-model-reasoning"]),
  selectedVisibilityType: z.enum(["public", "private"]),
  toolInvocations: z.array(toolInvocationSchema).max(5).optional(),
  // Optional flag indicating whether the client wants developer-mode
  // instrumentation (TypeScript plan + JSON result) included inline
  // in the final assistant markdown response.
  isDebugMode: z.boolean().optional(),
  // Auto Mode: AI can discover and use tools automatically
  // When combined with Auto Pay, enables Full Agentic Mode
  isAutoMode: z.boolean().optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
