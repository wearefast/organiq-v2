/**
 * Standalone migration runner.
 * Called by GitHub Actions (CI/CD) before the app container starts.
 * NOT imported by main.ts — kept separate so a migration failure never
 * blocks the app from starting.
 *
 * Usage: node dist/migrate.js
 *
 * Seeding logic:
 * If __drizzle_migrations is empty, it means the production DB was set up
 * without the Drizzle migrator (e.g. via drizzle-kit push or manual SQL).
 * In that case, all current journal entries are seeded as already applied
 * so Drizzle only runs genuinely NEW migrations going forward.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

async function seedMigrationHistoryIfEmpty(pool: Pool, migrationsFolder: string) {
  // Ensure the tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM "__drizzle_migrations"');
  const count = parseInt(rows[0].count, 10);

  if (count > 0) {
    console.log(`Migration history exists (${count} entries). Skipping seed.`);
    return;
  }

  // No history — DB was set up without the migrator. Seed all current journal
  // entries as already applied so migrate() only runs genuinely new ones.
  console.log('No migration history found. Seeding existing migrations as applied...');

  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));

  for (const entry of journal.entries) {
    const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      console.warn(`  WARNING: ${entry.tag}.sql not found — skipping`);
      continue;
    }
    const content = fs.readFileSync(sqlPath, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    await pool.query(
      'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
      [hash, entry.when],
    );
    console.log(`  Seeded: ${entry.tag}`);
  }

  console.log('Seed complete. Future migrations will be tracked automatically.');
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

  await seedMigrationHistoryIfEmpty(pool, migrationsFolder);

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

