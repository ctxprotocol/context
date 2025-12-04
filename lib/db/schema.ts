import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  json,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "../usage";

// Flow types for cost estimation
export type FlowType = "manual_simple" | "manual_tools" | "auto_mode";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).unique(), // Make unique, but nullable
  password: varchar("password", { length: 64 }), // Make nullable
  privyDid: varchar("privyDid", { length: 255 }).unique(), // Add this line
  walletAddress: varchar("wallet_address", { length: 42 }), // Ethereum address for quick lookup
  isDeveloper: boolean("is_developer").notNull().default(false),
});

export type User = InferSelectModel<typeof user>;

// Supported BYOK providers (explicitly NO OpenAI)
export type BYOKProvider = "kimi" | "gemini" | "anthropic";

// User Settings for BYOK and tier management
export const userSettings = pgTable("UserSettings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id),

  // BYOK Settings - Multiple provider support
  // Note: We explicitly do NOT support OpenAI due to their API usage tracking practices
  kimiApiKeyEncrypted: text("kimi_api_key_encrypted"), // Moonshot/Kimi API key
  geminiApiKeyEncrypted: text("gemini_api_key_encrypted"), // Google Gemini API key
  anthropicApiKeyEncrypted: text("anthropic_api_key_encrypted"), // Anthropic Claude API key

  // Which provider to use for BYOK (null = use platform default)
  byokProvider: varchar("byok_provider", { length: 20 }), // "kimi" | "gemini" | "anthropic"

  useBYOK: boolean("use_byok").notNull().default(false),

  // Tier Settings: "free" | "byok" | "convenience"
  tier: varchar("tier", { length: 20 }).notNull().default("free"),

  // Convenience Tier - Model Cost Pass-through
  enableModelCostPassthrough: boolean("enable_model_cost_passthrough")
    .notNull()
    .default(false),

  // Accumulated model costs (for convenience tier billing)
  accumulatedModelCost: numeric("accumulated_model_cost", {
    precision: 18,
    scale: 6,
  })
    .notNull()
    .default("0"),

  // Free tier tracking (daily reset)
  freeQueriesUsedToday: integer("free_queries_used_today").notNull().default(0),
  freeQueriesResetAt: timestamp("free_queries_reset_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserSettings = InferSelectModel<typeof userSettings>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  lastContext: jsonb("lastContext").$type<AppUsage | null>(),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

export const aiTool = pgTable("AITool", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  developerId: uuid("developer_id")
    .notNull()
    .references(() => user.id),
  developerWallet: varchar("developer_wallet", { length: 42 }).notNull(),
  pricePerQuery: numeric("price_per_query", { precision: 18, scale: 6 })
    .notNull()
    .default("0.01"),
  toolSchema: jsonb("tool_schema").notNull(),
  apiEndpoint: text("api_endpoint").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  category: varchar("category", { length: 100 }),
  iconUrl: text("icon_url"),

  // Verification fields (use immediately)
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedBy: uuid("verified_by").references(() => user.id),
  verifiedAt: timestamp("verified_at"),

  // Analytics & reputation (start collecting from day 1)
  totalQueries: integer("total_queries").notNull().default(0),
  totalRevenue: numeric("total_revenue", { precision: 18, scale: 6 })
    .notNull()
    .default("0"),
  averageRating: numeric("average_rating", { precision: 3, scale: 2 }),
  totalReviews: integer("total_reviews").notNull().default(0),

  // Reliability metrics
  uptimePercent: numeric("uptime_percent", { precision: 5, scale: 2 }).default(
    "100"
  ),
  successRate: numeric("success_rate", { precision: 5, scale: 2 }).default(
    "100"
  ),

  // Moderation
  totalFlags: integer("total_flags").notNull().default(0),

  // Future-proof placeholders (nullable, unused for MVP)
  listingFee: numeric("listing_fee", { precision: 18, scale: 6 }),
  totalStaked: numeric("total_staked", { precision: 18, scale: 6 }).default(
    "0"
  ),

  // Vector search fields (pgvector)
  // Note: The 'embedding' column is vector(1536) - managed via raw SQL
  // since Drizzle doesn't natively support the vector type
  searchText: text("search_text"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AITool = InferSelectModel<typeof aiTool>;

export const toolQuery = pgTable("ToolQuery", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  toolId: uuid("tool_id")
    .notNull()
    .references(() => aiTool.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
  chatId: uuid("chat_id").references(() => chat.id),
  amountPaid: numeric("amount_paid", { precision: 18, scale: 6 }).notNull(),
  transactionHash: varchar("transaction_hash", { length: 66 }).notNull(),
  status: varchar("status", { enum: ["pending", "completed", "failed"] })
    .notNull()
    .default("pending"),
  queryInput: jsonb("query_input"),
  queryOutput: jsonb("query_output"),
  executedAt: timestamp("executed_at").notNull().defaultNow(),
});

export type ToolQuery = InferSelectModel<typeof toolQuery>;

export const toolReport = pgTable("ToolReport", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  toolId: uuid("tool_id")
    .notNull()
    .references(() => aiTool.id),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => user.id),
  reason: text("reason").notNull(),
  status: varchar("status", { enum: ["pending", "resolved"] })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ToolReport = InferSelectModel<typeof toolReport>;

// API Keys for programmatic access to Context Protocol
export const apiKey = pgTable("ApiKey", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
  name: varchar("name", { length: 100 }).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ApiKey = InferSelectModel<typeof apiKey>;

/**
 * Model cost history for dynamic estimation
 * Tracks actual vs estimated costs per flow type for feedback loop
 */
export const modelCostHistory = pgTable("ModelCostHistory", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  chatId: uuid("chat_id").notNull(),
  modelId: text("model_id").notNull(),

  // Flow classification
  flowType: text("flow_type").notNull().$type<FlowType>(),

  // Cost tracking
  estimatedCost: numeric("estimated_cost", { precision: 18, scale: 6 }).notNull(),
  actualCost: numeric("actual_cost", { precision: 18, scale: 6 }).notNull(),
  aiCallCount: integer("ai_call_count").notNull().default(1),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ModelCostHistory = InferSelectModel<typeof modelCostHistory>;

/**
 * Flow cost multipliers - learned from historical data
 * Updated via exponential moving average
 */
export const flowCostMultipliers = pgTable(
  "FlowCostMultipliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelId: text("model_id").notNull(),
    flowType: text("flow_type").notNull().$type<FlowType>(),

    // Learned multiplier (how many times base estimate)
    multiplier: numeric("multiplier", { precision: 10, scale: 4 })
      .notNull()
      .default("1.0"),

    // Confidence tracking
    sampleCount: integer("sample_count").notNull().default(0),
    lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  },
  (table) => ({
    uniqueModelFlow: unique().on(table.modelId, table.flowType),
  })
);

export type FlowCostMultiplier = InferSelectModel<typeof flowCostMultipliers>;
