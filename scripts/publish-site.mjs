/**
 * Publish apps/web to Vercel. Reads secrets from local env files and never prints them.
 *
 * Usage (from repo root): node scripts/publish-site.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  }
}

function vercel(args) {
  run('npx', ['vercel', ...args]);
}

const rootEnv = parseEnvFile(path.join(root, '.env'));
const webEnv = parseEnvFile(path.join(root, 'apps/web/.env.local'));

const supabaseUrl =
  webEnv.NEXT_PUBLIC_SUPABASE_URL || rootEnv.SUPABASE_URL || '';
const publishableKey =
  webEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';
const dbUrl = rootEnv.SUPABASE_DB_URL || '';

if (!supabaseUrl || !publishableKey || !dbUrl) {
  console.error(
    'Missing env. Need SUPABASE_DB_URL in .env and NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/web/.env.local',
  );
  process.exit(1);
}

if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
  console.error('SUPABASE_DB_URL points at local Postgres. Use the Supabase session pooler URI for Vercel.');
  process.exit(1);
}
if (dbUrl.includes('db.') && dbUrl.includes('supabase.co')) {
  console.warn(
    'SUPABASE_DB_URL is the direct (IPv6) host. If the Vercel build cannot reach the DB, switch to the session pooler URI from Supabase → Settings → Database.',
  );
}

console.log('Installing dependencies…');
run('npm', ['install']);

console.log('Checking Vercel auth…');
const whoami = spawnSync('npx', ['vercel', 'whoami'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
});
if (whoami.status !== 0) {
  console.log('Not logged in. Starting Vercel login (browser)…');
  vercel(['login']);
} else {
  console.log(`Logged in as ${whoami.stdout.trim()}`);
}

console.log('Linking Vercel project wild-rift-forge…');
vercel(['link', '--yes', '--project', 'wild-rift-forge']);

const projectFile = path.join(root, '.vercel', 'project.json');
if (existsSync(projectFile)) {
  const { projectId } = JSON.parse(readFileSync(projectFile, 'utf8'));
  console.log('Setting Vercel Root Directory to apps/web…');
  const patch = spawnSync(
    'npx',
    [
      'vercel',
      'api',
      `v9/projects/${projectId}`,
      '-X',
      'PATCH',
      '--input',
      JSON.stringify({ rootDirectory: 'apps/web' }),
    ],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (patch.status !== 0) {
    console.warn(
      'Could not set rootDirectory via API. In the Vercel dashboard, set Root Directory to apps/web.',
    );
  }
}

function upsertEnv(name, value, targets) {
  for (const target of targets) {
    console.log(`Setting ${name} for ${target}…`);
    const result = spawnSync(
      'npx',
      ['vercel', 'env', 'add', name, target, '--value', value, '--yes', '--force'],
      { cwd: root, encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (result.status !== 0) {
      const err = `${result.stdout || ''}${result.stderr || ''}`;
      if (!/already exists|already been added/i.test(err)) {
        console.error(`Failed to set ${name} for ${target}`);
        process.stderr.write(err);
        throw new Error(`vercel env add ${name} ${target} failed`);
      }
    }
  }
}

upsertEnv('SUPABASE_DB_URL', dbUrl, ['production', 'preview']);
upsertEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl, ['production', 'preview']);
upsertEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', publishableKey, [
  'production',
  'preview',
]);

console.log('Connecting GitHub repo…');
const gitConnect = spawnSync('npx', ['vercel', 'git', 'connect'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  stdio: 'inherit',
});
if (gitConnect.status !== 0) {
  console.warn('vercel git connect did not succeed; you can connect the GitHub repo in the Vercel dashboard.');
}

console.log('Deploying production…');
vercel(['deploy', '--prod', '--yes']);

console.log('Done.');
