import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/artifact";
import type { VisibilityType } from "@/components/visibility-selector";
import {
  buildSearchText,
  formatEmbeddingForPg,
  generateEmbedding,
} from "../ai/embeddings";
import { ChatSDKError } from "../errors";
import type { AppUsage } from "../usage";
import { generateUUID } from "../utils";
import {
  type ApiKey,
  aiTool,
  apiKey,
  type Chat,
  chat,
  type DBMessage,
  document,
  message,
  type Suggestion,
  stream,
  suggestion,
  toolQuery,
  type User,
  type UserSettings,
  user,
  userSettings,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const users = await db.select().from(user).where(eq(user.id, id));
    return users[0] ?? null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get user by id");
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save document");
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store merged server-enriched usage object
  context: AppUsage;
}) {
  try {
    return await db
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update lastContext for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

/**
 * Finds a user by their Privy DID. If the user doesn't exist, it creates a new one.
 * This is an "upsert" operation specific to our authentication flow.
 * @param privyDid - The user's Decentralized Identifier from Privy.
 * @param email - The user's email, if available from Privy.
 * @returns The user record from the database.
 */
export async function findOrCreateUserByPrivyDid(
  privyDid: string,
  email?: string
) {
  try {
    // First, try to find the user
    const existingUsers = await db
      .select()
      .from(user)
      .where(eq(user.privyDid, privyDid));
    let dbUser = existingUsers[0];

    // If the user does not exist, create them
    if (!dbUser) {
      const newUserResult = await db
        .insert(user)
        .values({
          privyDid,
          email,
        })
        .returning();
      dbUser = newUserResult[0];
    }

    return dbUser;
  } catch (error) {
    console.error("Database error in findOrCreateUserByPrivyDid:", error);
    return null;
  }
}

// ============================================================================
// AI TOOL MARKETPLACE QUERIES
// ============================================================================

/**
 * Create a new AI tool listing
 * Automatically marks the user as a developer on their first tool creation
 * Generates semantic embedding for vector search
 */
export async function createAITool({
  name,
  description,
  developerId,
  developerWallet,
  pricePerQuery,
  toolSchema,
  apiEndpoint,
  category,
  iconUrl,
}: {
  name: string;
  description: string;
  developerId: string;
  developerWallet: string;
  pricePerQuery: string; // e.g., "0.01" for $0.01
  toolSchema: Record<string, unknown>; // JSON schema for tool parameters
  apiEndpoint: string;
  category?: string;
  iconUrl?: string;
}) {
  try {
    // Build search text and generate embedding for vector search
    const searchText = buildSearchText({
      name,
      description,
      category,
      toolSchema,
    });

    let embeddingStr: string | null = null;
    try {
      const embedding = await generateEmbedding(searchText);
      embeddingStr = formatEmbeddingForPg(embedding);
    } catch (embeddingError) {
      // Log but don't fail tool creation if embedding fails
      console.warn(
        "[createAITool] Failed to generate embedding, tool will use fallback search:",
        embeddingError
      );
    }

    // Create the tool with embedding if available
    let newTool;
    if (embeddingStr) {
      // Ensure undefined values are converted to null for raw SQL
      const categoryVal = category ?? null;
      const iconUrlVal = iconUrl ?? null;

      const result = await db.execute(sql`
        INSERT INTO "AITool" (
          name, description, developer_id, developer_wallet, 
          price_per_query, tool_schema, api_endpoint, category, 
          icon_url, is_active, search_text, embedding
        ) VALUES (
          ${name}, ${description}, ${developerId}, ${developerWallet},
          ${pricePerQuery}, ${JSON.stringify(toolSchema)}::jsonb, ${apiEndpoint}, 
          ${categoryVal}, ${iconUrlVal}, true, ${searchText}, ${embeddingStr}::vector
        )
        RETURNING *
      `);
      // Handle both array and object-with-rows formats from db.execute()
      const rows = Array.isArray(result) ? result : (result.rows ?? []);
      newTool = rows[0];
    } else {
      // Fallback: create without embedding
      const result = await db
        .insert(aiTool)
        .values({
          name,
          description,
          developerId,
          developerWallet,
          pricePerQuery,
          toolSchema,
          apiEndpoint,
          category,
          iconUrl,
          isActive: true,
          searchText,
        })
        .returning();
      newTool = result[0];
    }

    // Mark user as developer if not already
    await db
      .update(user)
      .set({ isDeveloper: true })
      .where(eq(user.id, developerId));

    return newTool;
  } catch (error) {
    console.error("Failed to create AI tool:", error);
    throw new ChatSDKError("bad_request:database", "Failed to create AI tool");
  }
}

/**
 * Get all active AI tools (for marketplace listing)
 * Supports pagination and returns only essential columns for listing
 */
export async function getActiveAITools({
  limit = 50,
  offset = 0,
  category,
  includeCount = false,
}: {
  limit?: number;
  offset?: number;
  category?: string;
  includeCount?: boolean;
} = {}) {
  try {
    const whereConditions = category
      ? and(eq(aiTool.isActive, true), eq(aiTool.category, category))
      : eq(aiTool.isActive, true);

    // Select columns needed for listing and payment
    const tools = await db
      .select({
        id: aiTool.id,
        name: aiTool.name,
        description: aiTool.description,
        category: aiTool.category,
        pricePerQuery: aiTool.pricePerQuery,
        iconUrl: aiTool.iconUrl,
        isVerified: aiTool.isVerified,
        totalQueries: aiTool.totalQueries,
        averageRating: aiTool.averageRating,
        toolSchema: aiTool.toolSchema, // Needed to determine tool type (native/MCP)
        developerWallet: aiTool.developerWallet, // Needed for payment execution
      })
      .from(aiTool)
      .where(whereConditions)
      .orderBy(desc(aiTool.totalQueries))
      .limit(limit)
      .offset(offset);

    if (includeCount) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(aiTool)
        .where(whereConditions);

      return { tools, total, hasMore: offset + tools.length < total };
    }

    return tools;
  } catch (error) {
    console.error("Failed to get active AI tools:", error);
    throw new ChatSDKError("bad_request:database", "Failed to get AI tools");
  }
}

/**
 * Get all active AI tools with full data (for admin pages)
 * Returns all columns including toolSchema
 */
export async function getActiveAIToolsFull() {
  try {
    return await db
      .select()
      .from(aiTool)
      .where(eq(aiTool.isActive, true))
      .orderBy(desc(aiTool.totalQueries));
  } catch (error) {
    console.error("Failed to get full AI tools:", error);
    throw new ChatSDKError("bad_request:database", "Failed to get AI tools");
  }
}

/**
 * Get AI tool by ID
 */
export async function getAIToolById({ id }: { id: string }) {
  try {
    const tools = await db.select().from(aiTool).where(eq(aiTool.id, id));
    return tools[0];
  } catch (error) {
    console.error("Failed to get AI tool:", error);
    throw new ChatSDKError("bad_request:database", "Failed to get AI tool");
  }
}

/**
 * Get all tools created by a specific developer
 */
export async function getAIToolsByDeveloper({
  developerId,
}: {
  developerId: string;
}) {
  try {
    return await db
      .select()
      .from(aiTool)
      .where(eq(aiTool.developerId, developerId))
      .orderBy(desc(aiTool.createdAt));
  } catch (error) {
    console.error("Failed to get developer tools:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get developer tools"
    );
  }
}

/**
 * Get all tools by developer wallet address
 */
export async function getAIToolsByWallet({
  walletAddress,
}: {
  walletAddress: string;
}) {
  try {
    return await db
      .select()
      .from(aiTool)
      .where(eq(aiTool.developerWallet, walletAddress))
      .orderBy(desc(aiTool.createdAt));
  } catch (error) {
    console.error("Failed to get tools by wallet:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get tools by wallet"
    );
  }
}

/**
 * Update AI tool status (active/inactive)
 */
export async function updateAIToolStatus({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  try {
    return await db
      .update(aiTool)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(aiTool.id, id));
  } catch (error) {
    console.error("Failed to update tool status:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update tool status"
    );
  }
}

/**
 * Update the tool schema (used for refreshing MCP tool definitions)
 */
export async function updateAIToolSchema({
  id,
  toolSchema,
}: {
  id: string;
  toolSchema: Record<string, unknown>;
}) {
  try {
    return await db
      .update(aiTool)
      .set({ toolSchema, updatedAt: new Date() })
      .where(eq(aiTool.id, id));
  } catch (error) {
    console.error("Failed to update tool schema:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update tool schema"
    );
  }
}

/**
 * Update tool embedding for vector search
 * Called after schema refresh to keep embeddings in sync
 */
export async function updateAIToolEmbedding({
  id,
  searchText,
  embedding,
}: {
  id: string;
  searchText: string;
  embedding: number[];
}) {
  try {
    const embeddingStr = formatEmbeddingForPg(embedding);
    return await db.execute(sql`
      UPDATE "AITool"
      SET 
        search_text = ${searchText},
        embedding = ${embeddingStr}::vector,
        updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    console.error("Failed to update tool embedding:", error);
    // Don't throw - embedding update failures shouldn't break the app
  }
}

/**
 * Update AI tool metadata and optionally refresh embedding
 * Used when developer edits their tool or refreshes MCP skills
 */
export async function updateAITool({
  id,
  name,
  description,
  category,
  pricePerQuery,
  toolSchema,
}: {
  id: string;
  name?: string;
  description?: string;
  category?: string | null;
  pricePerQuery?: string;
  toolSchema?: Record<string, unknown>;
}) {
  try {
    // Build update object with only provided fields
    const updates: Partial<{
      name: string;
      description: string;
      category: string | null;
      pricePerQuery: string;
      toolSchema: unknown;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (pricePerQuery !== undefined) updates.pricePerQuery = pricePerQuery;
    if (toolSchema !== undefined) updates.toolSchema = toolSchema;

    // Update the tool
    const result = await db
      .update(aiTool)
      .set(updates)
      .where(eq(aiTool.id, id))
      .returning();

    const updatedTool = result.at(0);
    if (!updatedTool) return null;

    // Regenerate embedding if any searchable field changed
    const needsEmbeddingRefresh =
      name !== undefined ||
      description !== undefined ||
      category !== undefined ||
      toolSchema !== undefined;

    if (needsEmbeddingRefresh) {
      const searchText = buildSearchText({
        name: updatedTool.name,
        description: updatedTool.description,
        category: updatedTool.category,
        toolSchema: updatedTool.toolSchema as Record<string, unknown>,
      });

      try {
        const embedding = await generateEmbedding(searchText);
        await updateAIToolEmbedding({
          id,
          searchText,
          embedding,
        });
      } catch (embeddingError) {
        console.warn(
          "[updateAITool] Embedding refresh failed:",
          embeddingError
        );
        // Don't fail the update if embedding fails
      }
    }

    return updatedTool;
  } catch (error) {
    console.error("Failed to update AI tool:", error);
    throw new ChatSDKError("bad_request:database", "Failed to update AI tool");
  }
}

/**
 * Get tool data needed for embedding generation
 */
export async function getAIToolForEmbedding({ id }: { id: string }) {
  try {
    const tools = await db
      .select({
        id: aiTool.id,
        name: aiTool.name,
        description: aiTool.description,
        category: aiTool.category,
        toolSchema: aiTool.toolSchema,
      })
      .from(aiTool)
      .where(eq(aiTool.id, id));
    return tools[0];
  } catch (error) {
    console.error("Failed to get tool for embedding:", error);
    return null;
  }
}

/**
 * Record a paid query execution
 * Updates tool statistics (query count, revenue) and records the transaction
 */
export async function recordToolQuery({
  toolId,
  userId,
  chatId,
  amountPaid,
  transactionHash,
  queryInput,
  queryOutput,
  status = "completed",
}: {
  toolId: string;
  userId: string;
  chatId?: string;
  amountPaid: string; // e.g., "0.01"
  transactionHash: string;
  queryInput?: Record<string, unknown>;
  queryOutput?: Record<string, unknown>;
  status?: "completed" | "failed" | "pending";
}) {
  try {
    // Insert query record
    const [query] = await db
      .insert(toolQuery)
      .values({
        toolId,
        userId,
        chatId,
        amountPaid,
        transactionHash,
        queryInput,
        queryOutput,
        status,
        executedAt: new Date(),
      })
      .returning();

    // Update tool statistics (only for completed queries)
    if (status === "completed") {
      await db
        .update(aiTool)
        .set({
          totalQueries: sql`${aiTool.totalQueries} + 1`,
          totalRevenue: sql`${aiTool.totalRevenue} + ${amountPaid}`,
          updatedAt: new Date(),
        })
        .where(eq(aiTool.id, toolId));
    }

    return query;
  } catch (error) {
    console.error("Failed to record tool query:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to record tool query"
    );
  }
}

/**
 * Get query history for a specific tool
 */
export async function getToolQueryHistory({
  toolId,
  limit = 50,
}: {
  toolId: string;
  limit?: number;
}) {
  try {
    return await db
      .select()
      .from(toolQuery)
      .where(eq(toolQuery.toolId, toolId))
      .orderBy(desc(toolQuery.executedAt))
      .limit(limit);
  } catch (error) {
    console.error("Failed to get tool query history:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get query history"
    );
  }
}

/**
 * Get query history for a specific user
 */
export async function getUserQueryHistory({
  userId,
  limit = 50,
}: {
  userId: string;
  limit?: number;
}) {
  try {
    return await db
      .select()
      .from(toolQuery)
      .where(eq(toolQuery.userId, userId))
      .orderBy(desc(toolQuery.executedAt))
      .limit(limit);
  } catch (error) {
    console.error("Failed to get user query history:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user query history"
    );
  }
}

/**
 * Get total earnings for a developer (sum of all completed queries)
 */
export async function getDeveloperEarnings({
  developerId,
}: {
  developerId: string;
}) {
  try {
    const tools = await getAIToolsByDeveloper({ developerId });
    const totalRevenue = tools.reduce(
      (sum, tool) => sum + Number(tool.totalRevenue),
      0
    );
    const totalQueries = tools.reduce(
      (sum, tool) => sum + tool.totalQueries,
      0
    );

    return {
      totalRevenue: totalRevenue.toFixed(6),
      totalQueries,
      toolCount: tools.length,
      tools: tools.map((tool) => ({
        id: tool.id,
        name: tool.name,
        revenue: tool.totalRevenue,
        queries: tool.totalQueries,
      })),
    };
  } catch (error) {
    console.error("Failed to get developer earnings:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get developer earnings"
    );
  }
}

/**
 * Search AI tools using semantic vector search with pgvector
 * Falls back to LIKE search if vector search fails or returns no results
 *
 * @param query - Search term to match against tool embeddings
 * @param limit - Maximum number of results (default: 20)
 * @returns Tools sorted by semantic similarity, with similarity scores
 */
export async function searchAITools({
  query,
  limit = 20,
}: {
  query: string;
  limit?: number;
}) {
  if (!query || query.trim().length === 0) {
    // No query - return all active tools (without pagination for search)
    const allTools = await getActiveAITools({ limit: 100 });
    // getActiveAITools without includeCount returns an array
    const tools = Array.isArray(allTools) ? allTools : allTools.tools;
    return {
      tools,
      searchType: null as "vector" | "fallback" | null,
    };
  }

  try {
    // Try vector search first (semantic similarity)
    const vectorResults = await searchAIToolsVector({ query, limit });
    if (vectorResults.length > 0) {
      return { tools: vectorResults, searchType: "vector" as const };
    }

    // Fallback to LIKE search if no vector results
    console.log(
      "[searchAITools] No vector results, falling back to LIKE search"
    );
    const fallbackResults = await searchAIToolsFallback({ query, limit });
    return { tools: fallbackResults, searchType: "fallback" as const };
  } catch (error) {
    console.error(
      "[searchAITools] Vector search failed, using fallback:",
      error
    );
    const fallbackResults = await searchAIToolsFallback({ query, limit });
    return { tools: fallbackResults, searchType: "fallback" as const };
  }
}

// Minimum similarity threshold for vector search results
// Results below this threshold are filtered out (0.3 = 30% similarity)
const SIMILARITY_THRESHOLD = 0.3;

/**
 * Semantic vector search using pgvector
 * Returns tools sorted by cosine similarity to the query
 * Only includes results above the similarity threshold
 */
async function searchAIToolsVector({
  query,
  limit,
}: {
  query: string;
  limit: number;
}) {
  // Generate embedding for the search query
  const queryEmbedding = await generateEmbedding(query);
  const embeddingStr = formatEmbeddingForPg(queryEmbedding);

  // Search by cosine similarity using pgvector
  // The <=> operator computes cosine distance (1 - cosine_similarity)
  // We filter by similarity threshold to avoid returning irrelevant results
  const results = await db.execute(sql`
    SELECT 
      id,
      name,
      description,
      price_per_query as "pricePerQuery",
      tool_schema as "toolSchema",
      category,
      icon_url as "iconUrl",
      is_verified as "isVerified",
      is_active as "isActive",
      total_queries as "totalQueries",
      average_rating as "averageRating",
      developer_id as "developerId",
      developer_wallet as "developerWallet",
      api_endpoint as "apiEndpoint",
      created_at as "createdAt",
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM "AITool"
    WHERE is_active = true
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${SIMILARITY_THRESHOLD}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `);

  const rows = (
    Array.isArray(results) ? results : (results.rows ?? [])
  ) as Array<Record<string, unknown>>;

  // Log similarity scores for debugging
  if (rows.length > 0) {
    console.log(
      "[searchAIToolsVector] Results with similarity:",
      rows.map((r) => ({
        name: r.name,
        similarity: Number(r.similarity).toFixed(3),
      }))
    );
  }

  return rows.map((tool) => ({
    id: tool.id as string,
    name: tool.name as string,
    description: tool.description as string,
    pricePerQuery: tool.pricePerQuery as string,
    toolSchema: tool.toolSchema as Record<string, unknown>,
    category: tool.category as string | null,
    iconUrl: tool.iconUrl as string | null,
    isVerified: tool.isVerified as boolean,
    isActive: tool.isActive as boolean,
    totalQueries: tool.totalQueries as number,
    averageRating: tool.averageRating as string | null,
    developerId: tool.developerId as string,
    developerWallet: tool.developerWallet as string,
    apiEndpoint: tool.apiEndpoint as string,
    createdAt: tool.createdAt as Date,
    similarity: tool.similarity as number,
  }));
}

/**
 * Fallback LIKE search (used when vector search is unavailable)
 */
async function searchAIToolsFallback({
  query,
  limit,
}: {
  query: string;
  limit: number;
}) {
  const searchTerm = `%${query.toLowerCase()}%`;

  const results = await db.execute(sql`
    SELECT 
      id,
      name,
      description,
      price_per_query as "pricePerQuery",
      tool_schema as "toolSchema",
      category,
      icon_url as "iconUrl",
      is_verified as "isVerified",
      is_active as "isActive",
      total_queries as "totalQueries",
      average_rating as "averageRating",
      developer_id as "developerId",
      developer_wallet as "developerWallet",
      api_endpoint as "apiEndpoint",
      created_at as "createdAt"
    FROM "AITool"
    WHERE is_active = true
      AND (
        LOWER(name) LIKE ${searchTerm}
        OR LOWER(description) LIKE ${searchTerm}
        OR LOWER(category) LIKE ${searchTerm}
      )
    ORDER BY total_queries DESC
    LIMIT ${limit}
  `);

  const rows = (
    Array.isArray(results) ? results : (results.rows ?? [])
  ) as Array<Record<string, unknown>>;

  return rows.map((tool) => ({
    id: tool.id as string,
    name: tool.name as string,
    description: tool.description as string,
    pricePerQuery: tool.pricePerQuery as string,
    toolSchema: tool.toolSchema as Record<string, unknown>,
    category: tool.category as string | null,
    iconUrl: tool.iconUrl as string | null,
    isVerified: tool.isVerified as boolean,
    isActive: tool.isActive as boolean,
    totalQueries: tool.totalQueries as number,
    averageRating: tool.averageRating as string | null,
    developerId: tool.developerId as string,
    developerWallet: tool.developerWallet as string,
    apiEndpoint: tool.apiEndpoint as string,
    createdAt: tool.createdAt as Date,
    similarity: null,
  }));
}

/**
 * Get featured/verified AI tools
 */
export async function getFeaturedAITools({
  limit = 10,
}: {
  limit?: number;
} = {}) {
  try {
    return await db
      .select()
      .from(aiTool)
      .where(and(eq(aiTool.isActive, true), eq(aiTool.isVerified, true)))
      .orderBy(desc(aiTool.totalQueries))
      .limit(limit);
  } catch (error) {
    console.error("Failed to get featured tools:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get featured tools"
    );
  }
}

/**
 * Check if a transaction hash has already been used for a tool query
 * Used to prevent double-spending
 */
export async function getToolQueryByTransactionHash({
  transactionHash,
}: {
  transactionHash: string;
}) {
  try {
    const queries = await db
      .select()
      .from(toolQuery)
      .where(eq(toolQuery.transactionHash, transactionHash))
      .limit(1);
    return queries[0] || null;
  } catch (error) {
    console.error("Failed to get tool query by transaction hash:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to check transaction hash"
    );
  }
}

/**
 * Verify an AI tool (admin function)
 * Marks the tool as verified and records who verified it
 */
export async function verifyAITool({
  toolId,
  verifiedBy,
}: {
  toolId: string;
  verifiedBy: string;
}) {
  try {
    return await db
      .update(aiTool)
      .set({
        isVerified: true,
        verifiedBy,
        verifiedAt: new Date(),
      })
      .where(eq(aiTool.id, toolId));
  } catch (error) {
    console.error("Failed to verify tool:", error);
    throw new ChatSDKError("bad_request:database", "Failed to verify tool");
  }
}

// ============================================================================
// USER SETTINGS QUERIES (BYOK / Tier System)
// ============================================================================

/**
 * Get user settings by user ID
 */
export async function getUserSettings(
  userId: string
): Promise<UserSettings | null> {
  try {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    return settings ?? null;
  } catch (_error) {
    console.error("Failed to get user settings:", _error);
    return null;
  }
}

/**
 * Upsert user settings (create or update)
 */
export async function upsertUserSettings(
  userId: string,
  data: Partial<Omit<UserSettings, "userId" | "createdAt">>
) {
  try {
    return await db
      .insert(userSettings)
      .values({
        userId,
        ...data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
  } catch (error) {
    console.error("Failed to upsert user settings:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update user settings"
    );
  }
}

/**
 * Increment free queries used counter for a user.
 * Automatically resets if it's a new day.
 */
export async function incrementFreeQueriesUsed(
  userId: string
): Promise<number> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    // Get current settings
    const settings = await getUserSettings(userId);

    // Check if we need to reset (new day)
    if (
      !settings?.freeQueriesResetAt ||
      settings.freeQueriesResetAt < todayStart
    ) {
      await upsertUserSettings(userId, {
        freeQueriesUsedToday: 1,
        freeQueriesResetAt: now,
      });
      return 1;
    }

    // Increment
    const newCount = (settings.freeQueriesUsedToday ?? 0) + 1;
    await upsertUserSettings(userId, { freeQueriesUsedToday: newCount });
    return newCount;
  } catch (error) {
    console.error("Failed to increment free queries:", error);
    // Don't throw - just log and return 0 to avoid breaking the flow
    return 0;
  }
}

/**
 * Get the current free queries used today for a user.
 * Accounts for daily reset.
 */
export async function getFreeQueriesUsedToday(userId: string): Promise<number> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    const settings = await getUserSettings(userId);

    // Check if reset needed (new day)
    if (
      !settings?.freeQueriesResetAt ||
      settings.freeQueriesResetAt < todayStart
    ) {
      return 0;
    }

    return settings.freeQueriesUsedToday ?? 0;
  } catch (error) {
    console.error("Failed to get free queries count:", error);
    return 0;
  }
}

/**
 * Add accumulated model cost for convenience tier billing
 */
export async function addAccumulatedModelCost(
  userId: string,
  cost: number
): Promise<void> {
  try {
    const settings = await getUserSettings(userId);
    const currentCost = Number(settings?.accumulatedModelCost ?? 0);
    await upsertUserSettings(userId, {
      accumulatedModelCost: String(currentCost + cost),
    });
  } catch (error) {
    console.error("Failed to add accumulated model cost:", error);
    // Don't throw - just log to avoid breaking the flow
  }
}

/**
 * Reset accumulated model cost (after payment collection)
 */
export async function resetAccumulatedModelCost(userId: string): Promise<void> {
  try {
    await upsertUserSettings(userId, {
      accumulatedModelCost: "0",
    });
  } catch (error) {
    console.error("Failed to reset accumulated model cost:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to reset accumulated model cost"
    );
  }
}

// ============================================================================
// MODEL COST ESTIMATION QUERIES
// Note: Main cost estimation logic is in lib/ai/cost-estimation.ts
// These are convenience re-exports for components that need type access
// ============================================================================

export type { FlowType } from "./schema";

// ============================================================================
// API KEY MANAGEMENT (Context Protocol Public API)
// ============================================================================

/**
 * Create a new API key for a user
 * Returns the full key (shown only once) and the database record
 */
export async function createApiKey({
  userId,
  name,
  keyHash,
  keyPrefix,
}: {
  userId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
}): Promise<ApiKey> {
  try {
    const [newKey] = await db
      .insert(apiKey)
      .values({
        userId,
        name,
        keyHash,
        keyPrefix,
      })
      .returning();
    return newKey;
  } catch (error) {
    console.error("Failed to create API key:", error);
    throw new ChatSDKError("bad_request:database", "Failed to create API key");
  }
}

/**
 * Find an API key by its hash (for authentication)
 * Also updates lastUsedAt timestamp
 */
export async function getApiKeyByHash(
  keyHash: string
): Promise<(ApiKey & { user: User }) | null> {
  try {
    const result = await db
      .select()
      .from(apiKey)
      .innerJoin(user, eq(apiKey.userId, user.id))
      .where(eq(apiKey.keyHash, keyHash))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];

    // Update last used timestamp asynchronously (don't await)
    db.update(apiKey)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKey.id, row.ApiKey.id))
      .execute()
      .catch((err) => console.warn("Failed to update lastUsedAt:", err));

    return {
      ...row.ApiKey,
      user: row.User,
    };
  } catch (error) {
    console.error("Failed to get API key by hash:", error);
    return null;
  }
}

/**
 * Get all API keys for a user (for settings display)
 * Does NOT return the actual key hashes
 */
export async function getApiKeysByUserId(userId: string): Promise<ApiKey[]> {
  try {
    return await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.userId, userId))
      .orderBy(desc(apiKey.createdAt));
  } catch (error) {
    console.error("Failed to get API keys:", error);
    throw new ChatSDKError("bad_request:database", "Failed to get API keys");
  }
}

/**
 * Delete an API key by ID (must belong to user)
 */
export async function deleteApiKey({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<boolean> {
  try {
    const result = await db
      .delete(apiKey)
      .where(and(eq(apiKey.id, id), eq(apiKey.userId, userId)))
      .returning();
    return result.length > 0;
  } catch (error) {
    console.error("Failed to delete API key:", error);
    throw new ChatSDKError("bad_request:database", "Failed to delete API key");
  }
}

/**
 * Count API keys for a user (for limiting)
 */
export async function countApiKeysByUserId(userId: string): Promise<number> {
  try {
    const [result] = await db
      .select({ count: count() })
      .from(apiKey)
      .where(eq(apiKey.userId, userId));
    return result?.count ?? 0;
  } catch (error) {
    console.error("Failed to count API keys:", error);
    return 0;
  }
}
