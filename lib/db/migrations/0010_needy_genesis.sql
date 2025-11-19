CREATE TABLE IF NOT EXISTS "AITool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"developer_id" uuid NOT NULL,
	"developer_wallet" varchar(42) NOT NULL,
	"price_per_query" numeric(18, 6) DEFAULT '0.01' NOT NULL,
	"tool_schema" jsonb NOT NULL,
	"api_endpoint" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"category" varchar(100),
	"icon_url" text,
	"total_queries" integer DEFAULT 0 NOT NULL,
	"total_revenue" numeric(18, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ToolQuery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" uuid,
	"amount_paid" numeric(18, 6) NOT NULL,
	"transaction_hash" varchar(66) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"query_input" jsonb,
	"query_output" jsonb,
	"executed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "wallet_address" varchar(42);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AITool" ADD CONSTRAINT "AITool_developer_id_User_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ToolQuery" ADD CONSTRAINT "ToolQuery_tool_id_AITool_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."AITool"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ToolQuery" ADD CONSTRAINT "ToolQuery_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ToolQuery" ADD CONSTRAINT "ToolQuery_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
