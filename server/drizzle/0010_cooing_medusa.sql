CREATE TYPE "public"."intent_stage" AS ENUM('awareness', 'consideration', 'decision');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prompt_visibility_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"ai_engine" text NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"brand_mentioned" boolean NOT NULL,
	"mention_position" integer,
	"response_excerpt" text,
	"competitor_mentions" jsonb,
	"visibility_pct" numeric(5, 2),
	"sentiment" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracked_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"prompt_text" text NOT NULL,
	"intent_stage" "intent_stage" DEFAULT 'awareness',
	"engines" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prompt_visibility_results" ADD CONSTRAINT "prompt_visibility_results_prompt_id_tracked_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."tracked_prompts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prompt_visibility_results" ADD CONSTRAINT "prompt_visibility_results_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tracked_prompts" ADD CONSTRAINT "tracked_prompts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prompt_visibility_prompt_idx" ON "prompt_visibility_results" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prompt_visibility_project_idx" ON "prompt_visibility_results" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prompt_visibility_checked_idx" ON "prompt_visibility_results" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracked_prompts_project_idx" ON "tracked_prompts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracked_prompts_active_idx" ON "tracked_prompts" USING btree ("project_id","is_active");