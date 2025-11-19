CREATE TABLE IF NOT EXISTS "ToolReport" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AITool" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "AITool" ADD COLUMN "verified_by" uuid;--> statement-breakpoint
ALTER TABLE "AITool" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "AITool" ADD COLUMN "average_rating" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "AITool" ADD COLUMN "total_reviews" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "AITool" ADD COLUMN "uptime_percent" numeric(5, 2) DEFAULT '100';--> statement-breakpoint
ALTER TABLE "AITool" ADD COLUMN "success_rate" numeric(5, 2) DEFAULT '100';--> statement-breakpoint
ALTER TABLE "AITool" ADD COLUMN "total_flags" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "AITool" ADD COLUMN "listing_fee" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "AITool" ADD COLUMN "total_staked" numeric(18, 6) DEFAULT '0';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ToolReport" ADD CONSTRAINT "ToolReport_tool_id_AITool_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."AITool"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ToolReport" ADD CONSTRAINT "ToolReport_reporter_id_User_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AITool" ADD CONSTRAINT "AITool_verified_by_User_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
