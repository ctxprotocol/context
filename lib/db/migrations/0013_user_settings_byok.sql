-- Migration: Add UserSettings table for BYOK and tier management
-- This table stores user preferences for API keys and tier settings
-- Supports three providers: Kimi (Moonshot), Gemini (Google), Anthropic (Claude)
-- NOTE: OpenAI is explicitly NOT supported due to API usage tracking concerns

CREATE TABLE IF NOT EXISTS "UserSettings" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "User"("id"),
  
  -- BYOK API Keys (encrypted with AES-256-GCM)
  "kimi_api_key_encrypted" text,       -- Moonshot/Kimi API key
  "gemini_api_key_encrypted" text,      -- Google Gemini API key
  "anthropic_api_key_encrypted" text,   -- Anthropic Claude API key
  
  -- Active BYOK provider selection
  "byok_provider" varchar(20),          -- 'kimi' | 'gemini' | 'anthropic'
  
  -- Tier and BYOK flags
  "use_byok" boolean NOT NULL DEFAULT false,
  "tier" varchar(20) NOT NULL DEFAULT 'free',
  
  -- Convenience tier settings
  "enable_model_cost_passthrough" boolean NOT NULL DEFAULT false,
  "accumulated_model_cost" numeric(18, 6) NOT NULL DEFAULT '0',
  
  -- Free tier tracking
  "free_queries_used_today" integer NOT NULL DEFAULT 0,
  "free_queries_reset_at" timestamp,
  
  -- Timestamps
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Add index on tier for potential filtering
CREATE INDEX IF NOT EXISTS "idx_user_settings_tier" ON "UserSettings" ("tier");

-- Add index on byok_provider for analytics
CREATE INDEX IF NOT EXISTS "idx_user_settings_byok_provider" ON "UserSettings" ("byok_provider");

-- Comments for documentation
COMMENT ON TABLE "UserSettings" IS 'User settings for BYOK (Bring Your Own Key) and tier management';
COMMENT ON COLUMN "UserSettings"."kimi_api_key_encrypted" IS 'AES-256-GCM encrypted Moonshot/Kimi API key';
COMMENT ON COLUMN "UserSettings"."gemini_api_key_encrypted" IS 'AES-256-GCM encrypted Google Gemini API key';
COMMENT ON COLUMN "UserSettings"."anthropic_api_key_encrypted" IS 'AES-256-GCM encrypted Anthropic Claude API key';
COMMENT ON COLUMN "UserSettings"."byok_provider" IS 'Currently active BYOK provider: kimi, gemini, or anthropic';
COMMENT ON COLUMN "UserSettings"."tier" IS 'User tier: free, byok, or convenience';
COMMENT ON COLUMN "UserSettings"."accumulated_model_cost" IS 'Accumulated model costs for convenience tier billing';
