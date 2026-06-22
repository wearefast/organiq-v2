import { defineConfig } from 'drizzle-kit';

const baseUrl = process.env.DATABASE_URL || 'postgresql://pulse:pulse@localhost:5433/pulse_v2';
// RDS requires SSL. Append sslmode=require so the pg driver negotiates TLS.
// NODE_TLS_REJECT_UNAUTHORIZED=0 is set in the container env to accept the self-signed cert.
const connectionString = baseUrl.includes('rds.amazonaws.com')
  ? baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'sslmode=require'
  : baseUrl;

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
});
