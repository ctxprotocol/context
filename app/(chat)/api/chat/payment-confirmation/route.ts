import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getAIToolById, recordToolQuery } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const paymentConfirmationSchema = z.object({
  chatId: z.string().uuid(),
  autoModePayment: z.object({
    transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    toolIds: z.array(z.string().uuid()),
  }),
});

/**
 * POST /api/chat/payment-confirmation
 *
 * Records Auto Mode payment confirmation after the response has been delivered.
 * This is a lightweight endpoint that just records the payment without
 * triggering a new chat response (trust model).
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const json = await request.json();
    const { chatId, autoModePayment } = paymentConfirmationSchema.parse(json);

    console.log("[payment-confirmation] Recording payment", {
      chatId,
      userId: session.user.id,
      txHash: autoModePayment.transactionHash,
      toolIds: autoModePayment.toolIds,
    });

    // Record usage for each paid tool
    for (const toolId of autoModePayment.toolIds) {
      const tool = await getAIToolById({ id: toolId });
      if (tool) {
        await recordToolQuery({
          toolId,
          userId: session.user.id,
          chatId,
          amountPaid: tool.pricePerQuery,
          transactionHash: autoModePayment.transactionHash,
          status: "completed",
        });
      }
    }

    console.log("[payment-confirmation] Payment recorded successfully", {
      chatId,
      toolCount: autoModePayment.toolIds.length,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[payment-confirmation] Error:", error);

    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api").toResponse();
    }

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError("offline:chat").toResponse();
  }
}





