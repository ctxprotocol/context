/**
 * Storage Skill - Context Volume
 *
 * Provides persistent storage for large data that would otherwise bloat
 * the context window. Instead of returning 50KB of JSON in messages,
 * the agent saves it to Vercel Blob and returns a ~100 char URL.
 *
 * Use cases:
 * - Large CSV/JSON analysis results
 * - Aggregated data from multiple API calls
 * - Any output > 2000 characters
 */

import { put } from "@vercel/blob";
import { generateUUID } from "@/lib/utils";

export type SaveFileResult =
  | {
      status: "success";
      url: string;
      size: number;
      message: string;
    }
  | {
      status: "error";
      error: string;
    };

export type ReadFileResult =
  | {
      status: "success";
      content: string;
      size: number;
    }
  | {
      status: "error";
      error: string;
    };

/**
 * Save data to persistent storage (Vercel Blob)
 *
 * @param filename - The filename for the saved data (e.g., "report.csv", "analysis.json")
 * @param data - String or object to save. Objects are JSON-stringified.
 * @returns URL to the saved file, or error
 *
 * @example
 * const result = await saveFile("gas_analysis.json", { chains: [...], summary: "..." });
 * if (result.status === "success") {
 *   return { summary: "Analysis complete", dataUrl: result.url };
 * }
 */
export async function saveFile(
  filename: string,
  data: string | object
): Promise<SaveFileResult> {
  try {
    // Ensure data is a string
    const content =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);

    // Generate a unique path to prevent collisions
    const uniquePath = `agents/volumes/${generateUUID()}-${filename}`;

    // Upload to Vercel Blob
    // access: 'public' allows the frontend/user to download via URL
    const blob = await put(uniquePath, content, {
      access: "public",
      addRandomSuffix: false, // We already handled uniqueness
    });

    return {
      status: "success",
      url: blob.url,
      size: content.length,
      message:
        "Data saved to persistent storage. Use this URL to access it in future turns.",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { status: "error", error: msg };
  }
}

/**
 * Read data from a previously saved URL
 *
 * @param url - The Vercel Blob URL returned from saveFile
 * @returns The file content as a string, or error
 *
 * @example
 * const result = await readFile("https://...blob.vercel-storage.com/...");
 * if (result.status === "success") {
 *   const data = JSON.parse(result.content);
 * }
 */
export async function readFile(url: string): Promise<ReadFileResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const text = await response.text();
    return {
      status: "success",
      content: text,
      size: text.length,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { status: "error", error: msg };
  }
}

