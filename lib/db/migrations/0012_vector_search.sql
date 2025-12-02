-- Enable pgvector extension (Neon has it pre-installed)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to AITool table
-- Using 1536 dimensions (OpenAI text-embedding-3-small)
ALTER TABLE "AITool" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Add a text column to store the concatenated search text
-- (useful for debugging and re-embedding)
ALTER TABLE "AITool" ADD COLUMN IF NOT EXISTS "search_text" text;

-- Create HNSW index for fast similarity search
-- HNSW is faster than IVFFlat for most use cases
CREATE INDEX IF NOT EXISTS "AITool_embedding_idx" 
ON "AITool" USING hnsw ("embedding" vector_cosine_ops);








