-- Protocol Ledger: Referral System Migration
-- =============================================================================
-- Adds referral tracking capabilities for TGE allocation.
--
-- Key features:
-- 1. Each user gets a unique referral code they can share
-- 2. Track who referred whom via referred_by
-- 3. New engagement event types for enhanced activity tracking
--
-- Combined with existing EngagementEvent table, this enables comprehensive
-- referral-based allocation during TGE.
-- =============================================================================

-- Add referral fields to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referral_code" VARCHAR(12) UNIQUE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referred_by" UUID REFERENCES "User"(id);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP DEFAULT NOW();

-- Index for referral code lookups (used when new users sign up with a code)
CREATE INDEX IF NOT EXISTS idx_user_referral_code ON "User"(referral_code);

-- Index for finding users referred by a specific user
CREATE INDEX IF NOT EXISTS idx_user_referred_by ON "User"(referred_by);

-- Comments for documentation
COMMENT ON COLUMN "User"."referral_code" IS 'Unique invite code for referral tracking (Protocol Ledger)';
COMMENT ON COLUMN "User"."referred_by" IS 'User ID of the referrer, if this user was referred';

