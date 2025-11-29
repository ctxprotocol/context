CREATE TABLE IF NOT EXISTS "UserSettings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"kimi_api_key_encrypted" text,
	"gemini_api_key_encrypted" text,
	"anthropic_api_key_encrypted" text,
	"byok_provider" varchar(20),
	"use_byok" boolean DEFAULT false NOT NULL,
	"tier" varchar(20) DEFAULT 'free' NOT NULL,
	"enable_model_cost_passthrough" boolean DEFAULT false NOT NULL,
	"accumulated_model_cost" numeric(18, 6) DEFAULT '0' NOT NULL,
	"free_queries_used_today" integer DEFAULT 0 NOT NULL,
	"free_queries_reset_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AITool" ADD COLUMN "search_text" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
