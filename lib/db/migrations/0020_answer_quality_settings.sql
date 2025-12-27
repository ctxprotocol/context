-- Add Answer Quality settings to UserSettings table
-- These control AI verification steps in the agentic execution loop

ALTER TABLE "UserSettings" 
ADD COLUMN IF NOT EXISTS "enable_data_completeness_check" boolean NOT NULL DEFAULT true;

ALTER TABLE "UserSettings" 
ADD COLUMN IF NOT EXISTS "enable_response_quality_check" boolean NOT NULL DEFAULT true;



