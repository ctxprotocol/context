import { streamObject } from "ai";
import { z } from "zod";
import { myProvider } from "@/lib/ai/providers";
import { getDocumentById, saveSuggestions } from "@/lib/db/queries";
import type { Suggestion } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";
import { getSkillRuntime } from "./runtime";

export type RequestSuggestionsParams = {
  documentId: string;
};

export async function requestSuggestions({
  documentId,
}: RequestSuggestionsParams) {
  const { session, dataStream } = getSkillRuntime();
  if (!dataStream) {
    throw new Error("Data stream is required to stream suggestions");
  }

  const document = await getDocumentById({ id: documentId });

  if (!document || !document.content) {
    throw new Error("Document not found");
  }

  const suggestions: Omit<
    Suggestion,
    "userId" | "createdAt" | "documentCreatedAt"
  >[] = [];

  const suggestionSchema = z.object({
    originalSentence: z.string().describe("The original sentence"),
    suggestedSentence: z.string().describe("The suggested sentence"),
    description: z.string().describe("The description of the suggestion"),
  });

  const { elementStream } = streamObject({
    model: myProvider.languageModel("artifact-model"),
    system:
      "You are a helpful writing assistant. Given a piece of writing, offer improvements and describe why the change is helpful. Return at most 5 suggestions.",
    prompt: document.content,
    output: "array",
    schema: suggestionSchema,
  });

  type SuggestionElement = z.infer<typeof suggestionSchema>;

  for await (const element of elementStream as AsyncIterable<SuggestionElement>) {
    const suggestion: Suggestion = {
      id: generateUUID(),
      documentId,
      originalText: element.originalSentence,
      suggestedText: element.suggestedSentence,
      description: element.description,
      isResolved: false,
    } as Suggestion;

    suggestions.push(suggestion);
    dataStream.write({
      type: "data-suggestion",
      data: suggestion,
      transient: true,
    });
  }

  const userId = session.user?.id;
  if (userId) {
    await saveSuggestions({
      suggestions: suggestions.map((suggestion) => ({
        ...suggestion,
        userId,
        createdAt: new Date(),
        documentCreatedAt: document.createdAt,
      })),
    });
  }

  return {
    id: documentId,
    title: document.title,
    kind: document.kind,
    message: "Suggestions generated successfully.",
    totalSuggestions: suggestions.length,
  };
}


