ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "direct_competitors" text[];--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "custom_sitemap_url" text;