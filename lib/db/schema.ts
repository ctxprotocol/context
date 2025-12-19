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
// Note: Kimi/Moonshot support was removed in favor of OpenRouter
export type BYOKProvider = "gemini" | "anthropic";

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

  // Verification fields
  // NOTE: isVerified now means "Identity Verified" (GitHub/Twitter link), NOT "Code Verified"
  // Performance trust is derived from metrics (successRate, uptimePercent, totalQueries)
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedBy: uuid("verified_by").references(() => user.id),
  verifiedAt: timestamp("verified_at"),

  // Analytics & reputation (crypto-native metrics - primary trust indicators)
  totalQueries: integer("total_queries").notNull().default(0),
  totalRevenue: numeric("total_revenue", { precision: 18, scale: 6 })
    .notNull()
    .default("0"),

  // DEPRECATED: Web2-style ratings replaced by crypto-native metrics
  // Use successRate and totalQueries instead. Will be removed in future migration.
  averageRating: numeric("average_rating", { precision: 3, scale: 2 }),
  totalReviews: integer("total_reviews").notNull().default(0),

  // Reliability metrics (Trust Level 2 - Proven Status)
  // A tool is "Proven" when: totalQueries > 100 AND successRate > 95% AND uptimePercent > 98%
  uptimePercent: numeric("uptime_percent", { precision: 5, scale: 2 }).default(
    "100"
  ),
  successRate: numeric("success_rate", { precision: 5, scale: 2 }).default(
    "100"
  ),

  // Health check tracking (Trust Level 1 - Janitor)
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  lastHealthCheck: timestamp("last_health_check"),

  // Moderation
  totalFlags: integer("total_flags").notNull().default(0),

  // Staking (Trust Level 3 - Economic Security)
  // Tools priced >= $1.00/query require staking 100x the query price
  // This is synced from on-chain ContextRouter contract
  totalStaked: numeric("total_staked", { precision: 18, scale: 6 }).default(
    "0"
  ),

  // Future-proof placeholders
  listingFee: numeric("listing_fee", { precision: 18, scale: 6 }),

  // Level 4 Future-Proofing: Optimistic Payments / Escrow
  // For expensive queries ($10+), funds could be held pending validation
  pendingBalance: numeric("pending_balance", {
    precision: 18,
    scale: 6,
  }).default("0"),

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

// Dispute reason categories (objective, not subjective)
export type DisputeReason =
  | "schema_mismatch" // Output doesn't match declared outputSchema
  | "execution_error" // Tool threw an error or timed out
  | "malicious_content" // Tool returned harmful/scam content
  | "data_fabrication"; // Tool returned obviously fake data

// Dispute verdict from automated/manual adjudication
export type DisputeVerdict =
  | "pending" // Awaiting adjudication
  | "guilty" // Tool found at fault
  | "innocent" // Dispute dismissed
  | "manual_review"; // Requires human review

/**
 * ToolDispute (formerly ToolReport) - Web3 Dispute Resolution Protocol
 *
 * Key difference from Web2 reviews:
 * - Requires `transactionHash` as proof of payment (Sybil-resistant)
 * - Objective `reason` categories, not subjective ratings
 * - Automated `verdict` via schema validation
 *
 * This provides the Data Availability Layer for future slashing:
 * You can't slash based on "vibes" - you need specific fraud proofs.
 */
export const toolReport = pgTable("ToolReport", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  toolId: uuid("tool_id")
    .notNull()
    .references(() => aiTool.id),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => user.id),

  // THE FRAUD PROOF: Transaction hash proving disputant paid for query
  // This is what makes it Sybil-resistant - attackers must fund the developer
  transactionHash: varchar("transaction_hash", { length: 66 }),

  // Link to the actual query for validation
  queryId: uuid("query_id").references(() => toolQuery.id),

  // Structured reason (objective categories, not "vibe was off")
  reason: varchar("reason", { length: 50 }).notNull(),

  // User-provided details about the dispute
  details: text("details"),

  // Automated adjudication verdict
  verdict: varchar("verdict", { length: 20 }).default("pending"),

  // Schema validation errors (if reason is schema_mismatch)
  schemaErrors: jsonb("schema_errors"),

  // Status for workflow tracking
  status: varchar("status", { length: 20 }).notNull().default("pending"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ToolDispute = InferSelectModel<typeof toolReport>;
// Keep old type for backward compatibility
export type ToolReport = ToolDispute;

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
  estimatedCost: numeric("estimated_cost", {
    precision: 18,
    scale: 6,
  }).notNull(),
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

// =============================================================================
// PROTOCOL LEDGER: Engagement Events (Stealth Points System)
// =============================================================================
// This table captures "intent" signals that don't result in on-chain transactions.
// Combined with ToolQuery and AITool tables, this provides complete data for
// retroactive TGE allocation using the "Hyperliquid Path" approach.
//
// Key principle: We store RAW EVENTS, not points. The allocation formula is
// computed at TGE time from a private script (see scripts/allocation/).
// This prevents users from gaming the system.
// =============================================================================

export type EngagementEventType =
  | "MARKETPLACE_SEARCH" // User searched for tools (shows intent)
  | "TOOL_VIEW" // User viewed tool details
  | "WALLET_CONNECTED" // Privy wallet linked (high trust signal)
  | "USDC_APPROVED" // User approved spending (very high intent!)
  | "TOOL_CREATED" // Developer submitted a tool (supply side)
  | "TOOL_STAKED" // Developer staked on their tool (economic commitment)
  | "REFERRAL_LINK_CREATED" // User generated invite link
  | "REFERRAL_CONVERTED"; // Referred user made first payment

export const engagementEvent = pgTable("EngagementEvent", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),

  // The event type (what action was taken)
  eventType: varchar("event_type", { length: 50 })
    .notNull()
    .$type<EngagementEventType>(),

  // Optional resource link (toolId, referral code, etc.)
  resourceId: uuid("resource_id"),

  // Flexible metadata for event-specific data
  // e.g., { searchQuery: "gas prices", referrerId: "uuid" }
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type EngagementEvent = InferSelectModel<typeof engagementEvent>;
