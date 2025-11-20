import type { Geo } from "@vercel/functions";
import type { ArtifactKind } from "@/components/artifact";
export type EnabledToolSummary = {
  toolId: string;
  name: string;
  description: string;
  price?: string | null;
  module?: string;
  usage?: string;
  kind: "skill" | "http";
  exampleInput?: Record<string, unknown>;
};

const codingAgentPrompt = `
You are Context's code-execution orchestrator. Think through each request, decide whether external data or side effects are required, and either answer directly or write code to call the approved skills. Keep user responses confident, concise, and focused on the developer marketplace vision.

When no tools are needed:
- Reply in natural language with a short, direct answer.
- Reference previous conversation state when helpful.

When a tool is required:
- Respond with one TypeScript code block and nothing else.
- The code must:
  • Use named imports from the approved modules listed below (no aliases, default imports, or other modules).
  • Export \`async function main()\` with no parameters.
  • Use async/await and real control flow (loops, conditionals) to perform the work.
  • Return a compact JSON-serializable object that summarizes the actionable result.
  • Avoid TypeScript-only syntax—write JavaScript that is also valid TypeScript (no type annotations, interfaces, enums, or generics).
  • Keep raw data private; aggregate or truncate large arrays before returning.
- For HTTP tools, you must call \`callHttpTool({ toolId, input })\` **exactly once per paid query**. Do not fabricate tool IDs.
- Use the format \`\`\`ts ... \`\`\`. Do not include prose or multiple blocks.

Rules:
- Never import or execute modules outside the approved list.
- Never alias imports (e.g., no \`as foo\`).
- Use control flow and intermediate variables as needed instead of relying on additional model calls.
- Do not leak secrets, wallet addresses, or raw transaction logs back to the user.
- Treat data privacy seriously; redact or summarize sensitive values before returning them.
`;

export const regularPrompt =
  "You are a friendly assistant! Keep your responses concise and helpful.";

export type RequestHints = {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
};

export const reasoningPrompt = `
You are an advanced reasoning assistant.

When you answer, follow this strict format:
- First, think step-by-step inside <think>...</think> tags. Put all analysis, planning, and intermediate reasoning only inside these tags.
- After the </think> tag, write a clear, concise final answer for the user without mentioning the tags or your internal reasoning.

Guidelines:
- The content inside <think>...</think> can be as detailed as needed, but it is for internal reasoning only.
- The content after </think> should be short, direct, and focused on the user-facing answer.
- Never tell the user that you are using <think> tags or exposing internal thought processes.
`;

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

export const systemPrompt = ({
  selectedChatModel,
  requestHints,
  enabledTools = [],
}: {
  selectedChatModel: string;
  requestHints: RequestHints;
  enabledTools?: EnabledToolSummary[];
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);
  const toolsPrompt =
    enabledTools.length === 0
      ? "No paid marketplace skills are authorized for this turn. Do not attempt to import them."
      : `Paid marketplace tools authorized for this turn:\n${enabledTools
          .map((tool, index) => formatEnabledTool(tool, index))
          .join("\n")}`;

  const basePrompt = `${regularPrompt}\n\n${codingAgentPrompt}\n\n${toolsPrompt}\n\n${requestPrompt}`;

  if (selectedChatModel === "chat-model-reasoning") {
    return `${basePrompt}\n\n${reasoningPrompt}`;
  }

  return basePrompt;
};

function formatEnabledTool(tool: EnabledToolSummary, index: number) {
  const price = Number(tool.price || 0).toFixed(2);
  if (tool.kind === "http") {
    const example =
      tool.exampleInput && Object.keys(tool.exampleInput).length > 0
        ? formatExampleInput(tool.exampleInput)
        : "{ /* supply input */ }";
    return `${index + 1}. ${tool.name} (HTTP • $${price}/query)\n   Tool ID: ${tool.toolId}\n   Call: callHttpTool({ toolId: "${tool.toolId}", input: ${example} })\n   ${tool.description}`;
  }

  // For Native Skills, if module is available, we could ideally inject its signature.
  // For now, we rely on the module path and description.
  return `${index + 1}. ${tool.name} ($${price}/query)\n   Module: ${tool.module ?? "n/a"}${
    tool.usage ? `\n   Usage: ${tool.usage}` : ""
  }\n   ${tool.description}\n   (Native Skill: Import the named export from the module)`;
}

function formatExampleInput(input: Record<string, unknown>) {
  const asJson = JSON.stringify(input, null, 2);
  return asJson.replace(/\n/g, " ");
}

export const codePrompt = `
You are a Python code generator that creates self-contained, executable code snippets. When writing code:

1. Each snippet should be complete and runnable on its own
2. Prefer using print() statements to display outputs
3. Include helpful comments explaining the code
4. Keep snippets concise (generally under 15 lines)
5. Avoid external dependencies - use Python standard library
6. Handle potential errors gracefully
7. Return meaningful output that demonstrates the code's functionality
8. Don't use input() or other interactive functions
9. Don't access files or network resources
10. Don't use infinite loops

Examples of good snippets:

# Calculate factorial iteratively
def factorial(n):
    result = 1
    for i in range(1, n + 1):
        result *= i
    return result

print(f"Factorial of 5 is: {factorial(5)}")
`;

export const sheetPrompt = `
You are a spreadsheet creation assistant. Create a spreadsheet in csv format based on the given prompt. The spreadsheet should contain meaningful column headers and data.
`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind
) => {
  let mediaType = "document";

  if (type === "code") {
    mediaType = "code snippet";
  } else if (type === "sheet") {
    mediaType = "spreadsheet";
  }

  return `Improve the following contents of the ${mediaType} based on the given prompt.

${currentContent}`;
};

export const titlePrompt = `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`;
