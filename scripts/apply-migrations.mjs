// Apply SQL migrations from supabase/migrations/ in filename order.
// For the LOCAL dev database only. The remote Supabase project must be
// migrated with `npx supabase db push` per .cursor/rules/supabase.mdc.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('SUPABASE_DB_URL is not set.');
  process.exit(1);
}
if (connectionString.includes('supabase.co')) {
  console.error('SUPABASE_DB_URL points at a Supabase project — use `npx supabase db push` instead.');
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

await client.query(`CREATE TABLE IF NOT EXISTS _local_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`);

const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((file) => file.endsWith('.sql')).sort();
for (const file of files) {
  const { rows } = await client.query('SELECT 1 FROM _local_migrations WHERE name = $1', [file]);
  if (rows.length > 0) {
    console.log(`skip  ${file} (already applied)`);
    continue;
  }
  const sql = readFileSync(path.join(dir, file), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO _local_migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`apply ${file}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`FAILED ${file}: ${error.message}`);
    process.exit(1);
  }
}

await client.end();
console.log('Migrations up to date.');
