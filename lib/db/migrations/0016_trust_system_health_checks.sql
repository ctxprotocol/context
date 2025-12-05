-- Trust System Health Check Columns
-- Adds columns for automated health monitoring (Level 1 - The Janitor)

-- Track consecutive failures for auto-deactivation after 3 failures
ALTER TABLE "AITool" ADD COLUMN IF NOT EXISTS "consecutive_failures" integer DEFAULT 0 NOT NULL;

-- Track when the tool was last health-checked
ALTER TABLE "AITool" ADD COLUMN IF NOT EXISTS "last_health_check" timestamp;

-- Future-proofing for Level 4: Optimistic Payments / Escrow
-- For expensive queries ($10+), funds could be held pending validation
ALTER TABLE "AITool" ADD COLUMN IF NOT EXISTS "pending_balance" numeric(18, 6) DEFAULT '0';

-- Add index for health check queries (active tools sorted by last check time)
CREATE INDEX IF NOT EXISTS idx_aitool_health_check ON "AITool"(is_active, last_health_check);

-- Add index for consecutive failures (for finding tools to deactivate)
CREATE INDEX IF NOT EXISTS idx_aitool_failures ON "AITool"(consecutive_failures) WHERE is_active = true;



