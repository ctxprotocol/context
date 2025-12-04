import type {
  CoreAssistantMessage,
  CoreToolMessage,
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import type { DBMessage, Document } from '@/lib/db/schema';
import { ChatSDKError, type ErrorCode } from './errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatSDKError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatSDKError('offline:chat');
    }

    throw error;
  }
}

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(messages: UIMessage[]) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}

export function getTrailingMessageId({
  messages,
}: {
  messages: ResponseMessage[];
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) { return null; }

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}

export function getTextFromMessage(message: ChatMessage | UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { type: 'text'; text: string}).text)
    .join('');
}

export function formatWalletAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Convert a UUID string to a uint256 bigint for smart contract interactions.
 * 
 * UUIDs are 128-bit values (32 hex chars) which fit entirely into uint256.
 * This conversion is deterministic and collision-free since it preserves
 * the full UUID value without truncation.
 * 
 * @param uuid - UUID string (with or without dashes)
 * @returns bigint representation suitable for contract calls
 */
export function uuidToUint256(uuid: string): bigint {
  // Remove dashes and convert full hex string to bigint
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) {
    throw new Error(`Invalid UUID format: expected 32 hex chars, got ${hex.length}`);
  }
  return BigInt(`0x${hex}`);
}

/**
 * Format a price with smart decimal places.
 * - Shows 2 decimals for whole cents ($1.00, $0.10)
 * - Shows up to 4 decimals for micropayments ($0.001, $0.0001)
 * - Trims trailing zeros after the minimum 2 decimals
 */
export function formatPrice(price: number | string): string {
  const num = typeof price === 'string' ? Number.parseFloat(price) : price;
  if (Number.isNaN(num)) return '0.00';
  
  // Format with 4 decimal places, then trim unnecessary trailing zeros
  // but always keep at least 2 decimal places
  const formatted = num.toFixed(4);
  
  // Remove trailing zeros, but keep minimum 2 decimal places
  const trimmed = formatted.replace(/(\.\d{2})(\d*?)0+$/, '$1$2');
  
  // Clean up if we have trailing zeros after the 2nd decimal
  return trimmed.replace(/(\.\d{2})0+$/, '$1');
}
