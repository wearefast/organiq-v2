-- Forum Intelligence tables
DO $$ BEGIN
  CREATE TYPE "forum_topic_status" AS ENUM ('active', 'paused');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "forum_opportunity_status" AS ENUM ('new', 'seen', 'replied', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "forum_topics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "topic" text NOT NULL,
  "source" text NOT NULL DEFAULT 'auto',
  "status" "forum_topic_status" NOT NULL DEFAULT 'active',
  "last_scanned_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "forum_opportunities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "topic_id" uuid NOT NULL REFERENCES "forum_topics"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "title" text NOT NULL,
  "snippet" text,
  "subreddit" text,
  "published_date" text,
  "is_question" boolean NOT NULL DEFAULT false,
  "score" integer NOT NULL DEFAULT 0,
  "status" "forum_opportunity_status" NOT NULL DEFAULT 'new',
  "discovered_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "forum_topics_project_status_idx" ON "forum_topics" ("project_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "forum_topics_project_topic_idx" ON "forum_topics" ("project_id", "topic");
CREATE INDEX IF NOT EXISTS "forum_opps_project_status_idx" ON "forum_opportunities" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "forum_opps_topic_idx" ON "forum_opportunities" ("topic_id");
CREATE UNIQUE INDEX IF NOT EXISTS "forum_opps_project_url_idx" ON "forum_opportunities" ("project_id", "url");
