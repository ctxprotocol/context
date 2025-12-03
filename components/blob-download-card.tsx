"use client";

import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// Regex to detect Vercel Blob URLs
const BLOB_URL_REGEX =
  /https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[^\s"'<>]+/gi;

/**
 * Extract blob URLs from text content
 */
export function extractBlobUrls(text: string): string[] {
  const matches = text.match(BLOB_URL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Get file info from URL
 */
function getFileInfo(url: string): { name: string; extension: string } {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").pop() ?? "download";
    // Remove UUID prefix if present (format: uuid-filename.ext)
    const cleanName = filename.replace(/^[a-f0-9-]+-/i, "");
    const extension = cleanName.split(".").pop()?.toLowerCase() ?? "";
    return { name: cleanName, extension };
  } catch {
    return { name: "download", extension: "" };
  }
}

/**
 * Get icon based on file extension
 */
function FileIcon({ extension }: { extension: string }) {
  const iconClass = "size-4 shrink-0";

  switch (extension) {
    case "json":
      return <FileJson className={iconClass} />;
    case "csv":
    case "xlsx":
    case "xls":
      return <FileSpreadsheet className={iconClass} />;
    default:
      return <FileText className={iconClass} />;
  }
}

type BlobDownloadCardProps = {
  url: string;
  className?: string;
};

/**
 * A download card for Vercel Blob URLs
 * Follows Context Design System: rounded-md, shadow-sm, compact h-10 controls
 */
export function BlobDownloadCard({ url, className }: BlobDownloadCardProps) {
  const { name, extension } = getFileInfo(url);

  return (
    <a
      className={cn(
        // Base layout - compact control height per design system
        "inline-flex h-10 items-center gap-2 px-3",
        // Surface styling - rounded-md for controls, shadow-sm border
        "rounded-md border border-input bg-background shadow-sm",
        // Interactive states
        "transition-colors hover:bg-accent hover:text-accent-foreground",
        // Focus ring per design system
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
        className
      )}
      download={name}
      href={url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <FileIcon extension={extension} />
      <span className="truncate text-sm font-medium max-w-[200px]">{name}</span>
      <Download className="size-4 shrink-0 text-muted-foreground" />
    </a>
  );
}

type BlobDownloadListProps = {
  urls: string[];
  className?: string;
};

/**
 * Renders a list of blob download cards
 * Uses gap-2 per design system inline gap
 */
export function BlobDownloadList({ urls, className }: BlobDownloadListProps) {
  if (urls.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2 mt-3", className)}>
      {urls.map((url) => (
        <BlobDownloadCard key={url} url={url} />
      ))}
    </div>
  );
}

