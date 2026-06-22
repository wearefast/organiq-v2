import { defineConfig } from 'drizzle-kit';

const connectionString = process.env.DATABASE_URL || 'postgresql://pulse:pulse@localhost:5433/pulse_v2';
const isRds = connectionString.includes('rds.amazonaws.com');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
    ssl: isRds ? { rejectUnauthorized: false } : undefined,
  },
});
