/**
 * Ensures the drizzle __drizzle_migrations tracking table exists and is seeded.
 *
 * Problem: Production DB schema was applied manually (not via drizzle-kit), so the
 * __drizzle_migrations table doesn't exist. On first deployment, drizzle-kit would
 * try to re-run ALL migrations, failing with "type/table already exists" errors.
 *
 * This script:
 *   1. Creates __drizzle_migrations table if it doesn't exist
 *   2. If the table is empty, seeds it with SHA-256 hashes of all existing .sql files
 *      (marking them as already applied so drizzle-kit won't re-run them)
 *   3. If the table already has rows, does nothing (drizzle-kit handles new migrations)
 *
 * Run this BEFORE `drizzle-kit migrate` on every deployment.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

// Append sslmode=require for RDS — same logic as drizzle.config.ts
const connectionString = rawUrl.includes('rds.amazonaws.com')
  ? rawUrl + (rawUrl.includes('?') ? '&' : '?') + 'sslmode=require'
  : rawUrl;

const pool = new Pool({
  connectionString,
  ssl: rawUrl.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : false,
});

async function main() {
  const client = await pool.connect();
  try {
    // Step 1: Create the tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    // Step 2: Check if table already has entries
    const { rows } = await client.query('SELECT COUNT(*) AS cnt FROM "__drizzle_migrations"');
    const count = parseInt(rows[0].cnt, 10);

    if (count > 0) {
      console.log(`[seed-migration-journal] Table already has ${count} entries. Skipping seed.`);
      return;
    }

    // Step 3: Seed with SHA-256 hashes of all existing migration files
    const migrationsDir = path.join(__dirname, '../drizzle');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`[seed-migration-journal] Seeding ${files.length} migrations as already-applied...`);

    for (const file of files) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      await client.query(
        'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
        [hash, Date.now()]
      );
      console.log(`  ✓ ${file}`);
    }

    console.log('[seed-migration-journal] Done. Future deployments will only run new migrations.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('[seed-migration-journal] Failed:', e.message);
  process.exit(1);
});
