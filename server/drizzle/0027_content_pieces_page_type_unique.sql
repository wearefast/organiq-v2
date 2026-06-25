-- Add a partial unique index on (topical_map_page_id, type) for on-demand generated pieces.
-- This enforces at the DB level that each page can have at most one brief and one article
-- when created via the on-demand content generation path (topical_map_page_id IS NOT NULL).
-- Workflow-materialised pieces (topical_map_page_id IS NULL) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS "content_pieces_page_type_idx"
  ON "content_pieces" USING btree ("topical_map_page_id", "type")
  WHERE "topical_map_page_id" IS NOT NULL;
