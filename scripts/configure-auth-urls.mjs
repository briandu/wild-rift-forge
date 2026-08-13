#!/usr/bin/env node
/**
 * Set hosted Supabase Auth Site URL + allow-list so Google OAuth returns to
 * production (www) instead of localhost.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-auth-urls.mjs
 *
 * Token: Dashboard → Account → Access Tokens (the Wild Rift Forge org).
 *
 * Google Cloud Console still needs:
 *   Authorized JavaScript origins:
 *     http://localhost
 *     https://www.wildriftforge.com
 *     https://wildriftforge.com
 *   Authorized redirect URI (Supabase callback, not the app):
 *     https://<project-ref>.supabase.co/auth/v1/callback
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://www.wildriftforge.com';
const ALLOW_LIST = [
  'http://localhost:*/**',
  'http://127.0.0.1:*/**',
  'https://www.wildriftforge.com/**',
  'https://wildriftforge.com/**',
];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eq = trimmed.indexOf('=');
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}

const env = { ...parseEnvFile(path.join(root, '.env')), ...process.env };
const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const token = env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl) {
  console.error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).');
  process.exit(1);
}
if (!token) {
  console.error(
    'Missing SUPABASE_ACCESS_TOKEN. Create a personal access token in the Supabase dashboard, then rerun.',
  );
  process.exit(1);
}

const ref = new URL(supabaseUrl).hostname.split('.')[0];
const endpoint = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'User-Agent': 'SupabaseCLI/2.0',
};

const current = await fetch(endpoint, { headers });
if (!current.ok) {
  const text = (await current.text()).replaceAll(token, '[redacted]');
  console.error(`Auth config read failed (${current.status}): ${text.slice(0, 500)}`);
  process.exit(1);
}

const before = await current.json();
console.log(`Project ${ref}`);
console.log(`  site_url (was): ${before.site_url ?? '(unset)'}`);
console.log(`  uri_allow_list (was): ${before.uri_allow_list ?? '(unset)'}`);

const res = await fetch(endpoint, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    site_url: SITE_URL,
    uri_allow_list: ALLOW_LIST.join(','),
  }),
});

if (!res.ok) {
  const text = (await res.text()).replaceAll(token, '[redacted]');
  console.error(`Auth config update failed (${res.status}): ${text.slice(0, 500)}`);
  process.exit(1);
}

console.log(`  site_url (now): ${SITE_URL}`);
console.log(`  uri_allow_list (now): ${ALLOW_LIST.join(', ')}`);
console.log('Updated Auth URL configuration.');
