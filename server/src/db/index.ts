import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://calibrate:calibrate@localhost:5433/calibrate_commerce',
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
export { schema };
