CREATE TYPE "public"."access_grant_type" AS ENUM('org', 'workspace', 'project');--> statement-breakpoint
CREATE TYPE "public"."forum_opportunity_status" AS ENUM('new', 'seen', 'replied', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."forum_topic_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
ALTER TYPE "public"."org_role" ADD VALUE 'user';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"grant_type" "access_grant_type" NOT NULL,
	"workspace_id" uuid,
	"project_id" uuid,
	"granted_by_member_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"snippet" text,
	"subreddit" text,
	"published_date" text,
	"is_question" boolean DEFAULT false NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"status" "forum_opportunity_status" DEFAULT 'new' NOT NULL,
	"discovered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"source" text DEFAULT 'auto' NOT NULL,
	"status" "forum_topic_status" DEFAULT 'active' NOT NULL,
	"last_scanned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invited_by_member_id" uuid,
	"email" text NOT NULL,
	"role" "org_role" DEFAULT 'user' NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"token" text NOT NULL,
	"clerk_invitation_id" text,
	"access_grants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"revoked_at" timestamp,
	"revoked_by_member_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"base64" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_intelligence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"target_key" text DEFAULT '__foundation__' NOT NULL,
	"data_type" text NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"produced_by" text NOT NULL,
	"workflow_run_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"target_key" text,
	"data_type" text NOT NULL,
	"last_updated" timestamp NOT NULL,
	"reason" text NOT NULL,
	"suggested_by" text NOT NULL,
	"suggested_at" timestamp DEFAULT now() NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"refreshed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_credit_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"monthly_limit" integer NOT NULL,
	"current_month_usage" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_members" ALTER COLUMN "role" SET DEFAULT 'user';--> statement-breakpoint
ALTER TABLE "content_pieces" ADD COLUMN "scheduled_publish_at" timestamp;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sitemap_urls" text[];--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sitemap_discovered_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "business_profile" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "business_profile_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "targets" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "prompt_visibility_results" ADD COLUMN "response_text" text;--> statement-breakpoint
ALTER TABLE "step_artifacts" ADD COLUMN "thinking_content" text;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "target_key" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_member_id_org_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."org_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_granted_by_member_id_org_members_id_fk" FOREIGN KEY ("granted_by_member_id") REFERENCES "public"."org_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forum_opportunities" ADD CONSTRAINT "forum_opportunities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forum_opportunities" ADD CONSTRAINT "forum_opportunities_topic_id_forum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_member_id_org_members_id_fk" FOREIGN KEY ("invited_by_member_id") REFERENCES "public"."org_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_revoked_by_member_id_org_members_id_fk" FOREIGN KEY ("revoked_by_member_id") REFERENCES "public"."org_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_intelligence" ADD CONSTRAINT "project_intelligence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_intelligence" ADD CONSTRAINT "project_intelligence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_intelligence" ADD CONSTRAINT "project_intelligence_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_suggestions" ADD CONSTRAINT "refresh_suggestions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_suggestions" ADD CONSTRAINT "refresh_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_credit_limits" ADD CONSTRAINT "workspace_credit_limits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_credit_limits" ADD CONSTRAINT "workspace_credit_limits_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_grants_org_member_idx" ON "access_grants" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_grants_member_type_idx" ON "access_grants" USING btree ("member_id","grant_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_grants_workspace_idx" ON "access_grants" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_grants_project_idx" ON "access_grants" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_opps_project_status_idx" ON "forum_opportunities" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_opps_topic_idx" ON "forum_opportunities" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "forum_opps_project_url_idx" ON "forum_opportunities" USING btree ("project_id","url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topics_project_status_idx" ON "forum_topics" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "forum_topics_project_topic_idx" ON "forum_topics" USING btree ("project_id","topic");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_idx" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_org_status_idx" ON "invitations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_org_email_idx" ON "invitations" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_assets_project_idx" ON "project_assets" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pi_project_target_datatype_unique" ON "project_intelligence" USING btree ("project_id","target_key","data_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pi_org_project_idx" ON "project_intelligence" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pi_project_target_idx" ON "project_intelligence" USING btree ("project_id","target_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rs_project_active_idx" ON "refresh_suggestions" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_credit_limits_workspace_idx" ON "workspace_credit_limits" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_credit_limits_org_idx" ON "workspace_credit_limits" USING btree ("organization_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "domain";