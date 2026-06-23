/**
 * Standalone migration runner.
 * Called by GitHub Actions (CI/CD) before the app container starts.
 * NOT imported by main.ts — kept separate so a migration failure never
 * blocks the app from starting.
 *
 * Usage: node dist/migrate.js
 *
 * Seeding logic:
 * The production DB schema was applied manually before the Drizzle migrator
 * was introduced. __drizzle_migrations may be empty OR partially filled
 * (from a previous failed CI run that committed some rows before failing).
 *
 * For every journal entry whose hash is NOT yet in __drizzle_migrations, we
 * insert it as "already applied". This is idempotent and handles all cases:
 *   - Empty table: all entries seeded
 *   - Partially filled (e.g. 0000-0013 recorded): only missing ones seeded
 *   - Fully up to date: no-op
 *
 * Genuinely new migrations (future 0024+) won't be in the journal yet
 * and will run normally via migrate().
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

async function seedAppliedMigrations(pool: Pool, migrationsFolder: string) {
  // Ensure the tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  // Collect hashes already recorded (may be 0, partial, or complete)
  const { rows } = await pool.query('SELECT hash FROM "__drizzle_migrations"');
  const knownHashes = new Set(rows.map((r: { hash: string }) => r.hash));
  console.log(`Migration history: ${knownHashes.size} entries already recorded.`);

  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));

  let seeded = 0;
  for (const entry of journal.entries) {
    const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      console.warn(`  WARNING: ${entry.tag}.sql not found — skipping`);
      continue;
    }
    const content = fs.readFileSync(sqlPath, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    if (knownHashes.has(hash)) continue; // already tracked, skip

    await pool.query(
      'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
      [hash, entry.when],
    );
    console.log(`  Seeded as applied: ${entry.tag}`);
    seeded++;
  }

  if (seeded > 0) {
    console.log(`Seeded ${seeded} migration(s). Future migrations will be tracked automatically.`);
  } else {
    console.log('All journal entries already tracked. No seeding needed.');
  }
}

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const isRds = connectionString.includes('rds.amazonaws.com');
  const ssl = isRds ? { rejectUnauthorized: false } : undefined;

  const pool = new Pool({ connectionString, ssl });
  const migrationsFolder = path.join(__dirname, '..', 'drizzle');

  console.log(`Migrations folder: ${migrationsFolder}`);

  await seedAppliedMigrations(pool, migrationsFolder);

  const db = drizzle(pool);
  console.log('Running pending migrations...');
  await migrate(db, { migrationsFolder });
  await pool.end();
  console.log('Migrations complete.');
}

runMigrations()
  .then(() => {
    console.log('Migration successful. Exiting.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });

