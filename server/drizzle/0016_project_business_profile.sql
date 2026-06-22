ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "business_profile" jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "business_profile_updated_at" timestamp;
