-- Dispute Resolution Protocol Migration
-- Transform ToolReport from Web2 "Complaint Box" to Web3 "Dispute Resolution"
--
-- Key changes:
-- 1. Add transaction_hash requirement (Proof of Payment)
-- 2. Add structured reason enum (Objective categories)
-- 3. Add verdict for automated adjudication
-- 4. Add schema_errors for validation results

-- Add transaction_hash column (the Fraud Proof)
-- This is the key innovation: you can only dispute if you paid
ALTER TABLE "ToolReport" ADD COLUMN IF NOT EXISTS "transaction_hash" VARCHAR(66);

-- Add query_id reference for linking to the actual query data
ALTER TABLE "ToolReport" ADD COLUMN IF NOT EXISTS "query_id" UUID REFERENCES "ToolQuery"(id);

-- Add verdict column for automated adjudication results
-- 'pending' = awaiting adjudication
-- 'guilty' = schema validation failed, tool is at fault
-- 'innocent' = schema validation passed, dispute dismissed
-- 'manual_review' = requires human review (e.g., malicious_content)
ALTER TABLE "ToolReport" ADD COLUMN IF NOT EXISTS "verdict" VARCHAR(20) DEFAULT 'pending';

-- Add schema_errors to store ajv validation errors
ALTER TABLE "ToolReport" ADD COLUMN IF NOT EXISTS "schema_errors" JSONB;

-- Add details column for user-provided context
ALTER TABLE "ToolReport" ADD COLUMN IF NOT EXISTS "details" TEXT;

-- Update status enum to include 'dismissed' 
-- (Can't alter enum easily, so we change column type)
ALTER TABLE "ToolReport" ALTER COLUMN "status" TYPE VARCHAR(20);

-- Add index for transaction hash lookups
CREATE INDEX IF NOT EXISTS idx_tool_report_tx_hash ON "ToolReport"(transaction_hash);

-- Add index for tool disputes (for counting flags)
CREATE INDEX IF NOT EXISTS idx_tool_report_tool_verdict ON "ToolReport"(tool_id, verdict);

-- Comment for documentation
COMMENT ON TABLE "ToolReport" IS 'Dispute Resolution Protocol - Web3 fraud proofs requiring transaction_hash as proof of payment';
COMMENT ON COLUMN "ToolReport"."transaction_hash" IS 'Required proof that disputant paid for the query - prevents Sybil attacks';
COMMENT ON COLUMN "ToolReport"."verdict" IS 'Automated adjudication result: pending, guilty, innocent, manual_review';

