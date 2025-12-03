-- Dynamic Model Cost Estimation Migration
-- Tracks actual vs estimated costs per flow type for feedback loop

-- Model cost history for dynamic estimation
CREATE TABLE IF NOT EXISTS "ModelCostHistory" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  chat_id UUID NOT NULL,
  model_id TEXT NOT NULL,
  flow_type TEXT NOT NULL,
  estimated_cost NUMERIC(18, 6) NOT NULL,
  actual_cost NUMERIC(18, 6) NOT NULL,
  ai_call_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for querying by model and flow type (for calculating averages)
CREATE INDEX IF NOT EXISTS idx_model_cost_history_model_flow 
  ON "ModelCostHistory"(model_id, flow_type);

-- Index for time-based queries (for cleanup/archival)
CREATE INDEX IF NOT EXISTS idx_model_cost_history_created 
  ON "ModelCostHistory"(created_at);

-- Flow cost multipliers - learned from historical data
CREATE TABLE IF NOT EXISTS "FlowCostMultipliers" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL,
  flow_type TEXT NOT NULL,
  multiplier NUMERIC(10, 4) NOT NULL DEFAULT 1.0,
  sample_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(model_id, flow_type)
);

-- Seed with initial conservative multipliers
-- These account for self-healing retries (up to 2 per execution)
-- Values will be adjusted via EMA as actual costs are recorded
INSERT INTO "FlowCostMultipliers" (model_id, flow_type, multiplier, sample_count) VALUES
  ('chat-model', 'manual_simple', 1.0, 0),
  ('chat-model', 'manual_tools', 3.0, 0),
  ('chat-model', 'auto_mode', 5.0, 0),
  ('chat-model-reasoning', 'manual_simple', 1.0, 0),
  ('chat-model-reasoning', 'manual_tools', 3.0, 0),
  ('chat-model-reasoning', 'auto_mode', 5.0, 0)
ON CONFLICT (model_id, flow_type) DO NOTHING;

