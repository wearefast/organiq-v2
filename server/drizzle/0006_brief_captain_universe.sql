CREATE TABLE IF NOT EXISTS "gsc_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_url" text NOT NULL,
	"encrypted_access_token" text NOT NULL,
	"encrypted_refresh_token" text NOT NULL,
	"token_expires_at" timestamp,
	"last_sync_at" timestamp,
	"sync_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gsc_keyword_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"query" text NOT NULL,
	"page" text DEFAULT '' NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" numeric(8, 6),
	"position" numeric(8, 2),
	"date" timestamp NOT NULL,
	"country" text,
	"device" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gsc_connections" ADD CONSTRAINT "gsc_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gsc_connections" ADD CONSTRAINT "gsc_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gsc_keyword_data" ADD CONSTRAINT "gsc_keyword_data_connection_id_gsc_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."gsc_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gsc_keyword_data" ADD CONSTRAINT "gsc_keyword_data_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gsc_connections_project_idx" ON "gsc_connections" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gsc_connections_org_idx" ON "gsc_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gsc_keyword_data_connection_idx" ON "gsc_keyword_data" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gsc_keyword_data_project_date_idx" ON "gsc_keyword_data" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gsc_keyword_data_query_idx" ON "gsc_keyword_data" USING btree ("query");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gsc_keyword_data_unique_row_idx" ON "gsc_keyword_data" USING btree ("project_id","query","page","date");