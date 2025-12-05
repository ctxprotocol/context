-- API Keys for Context Protocol Public API
-- Allows developers to programmatically access marketplace tools
-- Keys are hashed (SHA-256) for secure storage

CREATE TABLE IF NOT EXISTS "ApiKey" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- SHA-256 hash of the full key (for lookup)
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  
  -- First 7 characters for display (e.g., "sk_live")
  key_prefix VARCHAR(12) NOT NULL,
  
  -- Owner of the key
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  
  -- Human-readable name (e.g., "Dev Key", "Production")
  name VARCHAR(100) NOT NULL,
  
  -- Usage tracking
  last_used_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for fast key lookup by hash
CREATE INDEX IF NOT EXISTS idx_api_key_hash ON "ApiKey"(key_hash);

-- Index for listing keys by user
CREATE INDEX IF NOT EXISTS idx_api_key_user ON "ApiKey"(user_id);



