-- Protocol Ledger: Engagement Events Migration
-- =============================================================================
-- This table enables the "Hyperliquid Path" for retroactive TGE allocation.
--
-- Key principles:
-- 1. Track raw events, not computed points
-- 2. Allocation formula is secret until TGE (scripts/allocation/ is gitignored)
-- 3. Events capture "intent" signals that don't result in on-chain transactions
--
-- Combined with ToolQuery (spending) and AITool (developer metrics), this
-- provides complete data for fair, Sybil-resistant token distribution.
-- =============================================================================

-- Create the EngagementEvent table
CREATE TABLE IF NOT EXISTS "EngagementEvent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "User"(id),
  
  -- Event type categorization
  -- MARKETPLACE_SEARCH: User searched for tools (shows intent)
  -- TOOL_VIEW: User viewed tool details
  -- WALLET_CONNECTED: Privy wallet linked (high trust signal)
  -- USDC_APPROVED: User approved spending (very high intent!)
  -- TOOL_CREATED: Developer submitted a tool (supply side)
  -- TOOL_STAKED: Developer staked on their tool (economic commitment)
  -- REFERRAL_LINK_CREATED: User generated invite link
  -- REFERRAL_CONVERTED: Referred user made first payment
  "event_type" VARCHAR(50) NOT NULL,
  
  -- Optional resource link (toolId, referral code, etc.)
  "resource_id" UUID,
  
  -- Flexible metadata for event-specific data
  -- e.g., { searchQuery: "gas prices", referrerId: "uuid" }
  "metadata" JSONB,
  
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for user lookups (TGE allocation computation)
CREATE INDEX IF NOT EXISTS idx_engagement_user_id ON "EngagementEvent"(user_id);

-- Index for event type analytics
CREATE INDEX IF NOT EXISTS idx_engagement_event_type ON "EngagementEvent"(event_type);

-- Composite index for user + event type queries
CREATE INDEX IF NOT EXISTS idx_engagement_user_event ON "EngagementEvent"(user_id, event_type);

-- Index for time-based queries (early believer detection)
CREATE INDEX IF NOT EXISTS idx_engagement_created_at ON "EngagementEvent"(created_at);

-- Comments for documentation
COMMENT ON TABLE "EngagementEvent" IS 'Protocol Ledger: Tracks user engagement events for retroactive TGE allocation (Hyperliquid Path)';
COMMENT ON COLUMN "EngagementEvent"."event_type" IS 'Categorized action type: MARKETPLACE_SEARCH, TOOL_VIEW, WALLET_CONNECTED, USDC_APPROVED, TOOL_CREATED, TOOL_STAKED, REFERRAL_LINK_CREATED, REFERRAL_CONVERTED';
COMMENT ON COLUMN "EngagementEvent"."metadata" IS 'Event-specific context data (search queries, referrer IDs, etc.)';





