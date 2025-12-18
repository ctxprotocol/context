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

// Auto Mode: Selected tool from discovery phase
const autoModeSelectedToolSchema = z.object({
  toolId: z.string().uuid(),
  name: z.string(),
  price: z.string(),
  // The specific MCP tool/method to call
  mcpToolName: z.string().optional(),
});

// Auto Mode: Payment confirmation for execution phase
const autoModePaymentSchema = z.object({
  // Transaction hash proving payment
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  // Tools that were selected in discovery phase and paid for
  selectedTools: z.array(autoModeSelectedToolSchema).min(1).max(10),
  // Original user query (from discovery phase)
  originalQuery: z.string().optional(),
});

// Model-cost-only payment (convenience tier, no tools)
// Used when Auto Mode discovery finds no tools needed
const modelCostPaymentSchema = z.object({
  // Transaction hash proving model cost payment
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  // Original query from discovery phase
  originalQuery: z.string().optional(),
});

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum([
    "gemini-flash-model",
    "gemini-model",
    "chat-model",
    "chat-model-reasoning",
  ]),
  selectedVisibilityType: z.enum(["public", "private"]),
  toolInvocations: z.array(toolInvocationSchema).max(5).optional(),
  // Optional flag indicating whether the client wants developer-mode
  // instrumentation (TypeScript plan + JSON result) included inline
  // in the final assistant markdown response.
  isDebugMode: z.boolean().optional(),
  // Auto Mode: AI can discover and use tools automatically
  // When combined with Auto Pay, enables Full Agentic Mode
  isAutoMode: z.boolean().optional(),
  // Auto Mode Execution Phase: Payment confirmation with selected tools
  // When present, this is the execution phase after discovery + payment
  autoModePayment: autoModePaymentSchema.optional(),
  // Model-cost-only payment (convenience tier, Auto Mode, no tools found)
  // When present, this is a response after discovery found no tools but model cost was paid
  modelCostPayment: modelCostPaymentSchema.optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
export type AutoModePayment = z.infer<typeof autoModePaymentSchema>;
export type AutoModeSelectedTool = z.infer<typeof autoModeSelectedToolSchema>;
export type ModelCostPayment = z.infer<typeof modelCostPaymentSchema>;
