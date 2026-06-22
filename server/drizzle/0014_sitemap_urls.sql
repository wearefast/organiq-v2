-- Add sitemap_urls and sitemap_discovered_at to projects table
-- sitemap_urls: array of page URLs discovered from the site's sitemap.xml
-- sitemap_discovered_at: when the sitemap was last crawled

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sitemap_urls text[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sitemap_discovered_at timestamp;
