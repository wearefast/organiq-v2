/**
 * Standalone migration runner.
 * Called by GitHub Actions (CI/CD) before the app container starts.
 * NOT imported by main.ts — kept separate so a migration failure never
 * blocks the app from starting.
 *
 * Usage: node dist/migrate.js
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as path from 'path';

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const isRds = connectionString.includes('rds.amazonaws.com');
  const ssl = isRds ? { rejectUnauthorized: false } : undefined;

  const pool = new Pool({ connectionString, ssl });
  const db = drizzle(pool);
  const migrationsFolder = path.join(__dirname, '..', 'drizzle');

  console.log(`Running migrations from ${migrationsFolder}...`);
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
