CREATE TABLE IF NOT EXISTS "content_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_piece_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"alt_text" text,
	"prompt" text,
	"base64" text NOT NULL,
	"revised_prompt" text,
	"size" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_pieces" ADD COLUMN "topical_map_id" uuid;--> statement-breakpoint
ALTER TABLE "content_pieces" ADD COLUMN "source_step_key" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_images" ADD CONSTRAINT "content_images_content_piece_id_content_pieces_id_fk" FOREIGN KEY ("content_piece_id") REFERENCES "public"."content_pieces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_images_piece_idx" ON "content_images" USING btree ("content_piece_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_images_piece_index_idx" ON "content_images" USING btree ("content_piece_id","index");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_pieces" ADD CONSTRAINT "content_pieces_topical_map_id_topical_maps_id_fk" FOREIGN KEY ("topical_map_id") REFERENCES "public"."topical_maps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_pieces_run_step_idx" ON "content_pieces" USING btree ("workflow_run_id","source_step_key");