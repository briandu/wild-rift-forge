// Local development database: a self-contained embedded Postgres instance.
// Used until the Wild Rift Forge Supabase project exists — the app connects via
// SUPABASE_DB_URL either way, so switching later is just an .env change.
//
// Usage: node scripts/dev-db.mjs   (keeps running; Ctrl+C to stop)

import { existsSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

const DATA_DIR = './.local/pgdata';
const PORT = 5544;

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: true,
  // Match Supabase: UTF-8 encoding (Windows initdb would otherwise pick WIN1252,
  // which cannot store characters like the arrows in Riot patch notes).
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

const isInitialized = existsSync(`${DATA_DIR}/PG_VERSION`);
if (!isInitialized) {
  console.log('Initializing local Postgres cluster...');
  await pg.initialise();
}

await pg.start();

try {
  await pg.createDatabase('wild_rift_forge');
  console.log('Created database wild_rift_forge.');
} catch {
  // Database already exists.
}

console.log(`Local Postgres running on port ${PORT}.`);
console.log(`Connection string: postgresql://postgres:postgres@localhost:${PORT}/wild_rift_forge`);
console.log('Press Ctrl+C to stop.');

const stop = async () => {
  console.log('Stopping local Postgres...');
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
