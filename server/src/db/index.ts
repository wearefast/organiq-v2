import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://pulse:pulse@localhost:5433/pulse_v2';
const isRds = connectionString.includes('rds.amazonaws.com');
const ssl = isRds ? { rejectUnauthorized: false } : undefined;

const pool = new Pool({ connectionString, ssl });

export const db = drizzle(pool, { schema });
export type Database = typeof db;
export { schema };
