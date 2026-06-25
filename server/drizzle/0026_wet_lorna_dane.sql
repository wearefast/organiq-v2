CREATE TABLE IF NOT EXISTS "topical_map_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topical_map_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"pillar_title" text NOT NULL,
	"cluster_title" text NOT NULL,
	"title" text NOT NULL,
	"keyword" text,
	"suggested_url" text,
	"content_type" text,
	"intent" text,
	"funnel_stage" text,
	"volume" integer,
	"difficulty" integer,
	"estimated_word_count" integer,
	"priority" text,
	"links_to" text[],
	"links_from" text[],
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_pieces" ADD COLUMN "topical_map_page_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "topical_map_pages" ADD CONSTRAINT "topical_map_pages_topical_map_id_topical_maps_id_fk" FOREIGN KEY ("topical_map_id") REFERENCES "public"."topical_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "topical_map_pages" ADD CONSTRAINT "topical_map_pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topical_map_pages_map_idx" ON "topical_map_pages" USING btree ("topical_map_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topical_map_pages_project_idx" ON "topical_map_pages" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "topical_map_pages_map_title_idx" ON "topical_map_pages" USING btree ("topical_map_id","title");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_pieces" ADD CONSTRAINT "content_pieces_topical_map_page_id_topical_map_pages_id_fk" FOREIGN KEY ("topical_map_page_id") REFERENCES "public"."topical_map_pages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_pieces_page_idx" ON "content_pieces" USING btree ("topical_map_page_id");