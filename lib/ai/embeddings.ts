import "server-only";

import { gateway } from "@ai-sdk/gateway";
import { embed } from "ai";

/**
 * Embedding Utility for Vector Search
 *
 * Uses Vercel AI Gateway with text-embedding-3-small model (1536 dimensions)
 * for generating semantic embeddings of tool descriptions.
 *
 * This is a platform cost (not charged to users) used for:
 * - Tool creation (one-time embedding)
 * - MCP schema refresh (hourly if changed)
 * - Marketplace search (Auto Mode discovery)
 */

/**
 * Generate embedding for a text string
 * Uses AI Gateway's text-embedding-3-small model (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Truncate text if too long (embedding models have token limits)
  const truncatedText = text.slice(0, 8000);

  const { embedding } = await embed({
    model: gateway.textEmbeddingModel("text-embedding-3-small"),
    value: truncatedText,
  });

  return embedding;
}

/**
 * Build search text from an AI tool for embedding
 * Combines name, description, category, and MCP skill info
 */
export function buildSearchText(tool: {
  name: string;
  description: string;
  category?: string | null;
  toolSchema?: Record<string, unknown> | null;
}): string {
  const parts: string[] = [tool.name, tool.description];

  if (tool.category) {
    parts.push(`Category: ${tool.category}`);
  }

  // For MCP tools, include skill names and descriptions
  const schema = tool.toolSchema as {
    kind?: string;
    tools?: Array<{ name: string; description?: string }>;
  } | null;

  if (schema?.kind === "mcp" && schema.tools) {
    for (const skill of schema.tools) {
      parts.push(`Skill: ${skill.name}`);
      if (skill.description) {
        parts.push(skill.description);
      }
    }
  }

  return parts.join("\n");
}

/**
 * Format embedding array as PostgreSQL vector string
 */
export function formatEmbeddingForPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

