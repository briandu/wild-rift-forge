import pg from 'pg';

export type DbClient = pg.Pool;

let pool: pg.Pool | null = null;

/** Lazily create a shared connection pool from SUPABASE_DB_URL. */
export function getPool(): pg.Pool {
  if (pool) {
    return pool;
  }
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error(
      'SUPABASE_DB_URL is not set. Copy .env.example to .env and fill in the Supabase connection string.',
    );
  }
  pool = new pg.Pool({
    connectionString,
    max: 5,
    // Supabase requires SSL; local Postgres typically does not.
    ssl: connectionString.includes('supabase.co') || connectionString.includes('supabase.com')
      ? { rejectUnauthorized: false }
      : undefined,
  });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
