-- Add project_assets table for user-uploaded assets

CREATE TABLE IF NOT EXISTS "project_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size" integer NOT NULL,
  "base64" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "project_assets_project_idx" ON "project_assets" ("project_id");
