#!/usr/bin/env node
/**
 * Enable custom SMTP on the hosted Supabase project (unlocks branded auth HTML).
 *
 *   RESEND_API_KEY=re_... SMTP_FROM=auth@yourdomain.com \
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-resend-smtp.mjs
 *
 * Then: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-auth-email-templates.mjs
 *
 * Google/Apple still need dashboard client IDs. Authorized origins:
 *   http://localhost:3001
 *   https://wildriftforge.com
 * Redirect URIs:
 *   http://localhost:3001/auth/callback
 *   https://wildriftforge.com/auth/callback
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
const apiKey = env.RESEND_API_KEY;
const from = env.SMTP_FROM ?? env.RESEND_FROM;

if (!supabaseUrl) {
  console.error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).');
  process.exit(1);
}
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN.');
  process.exit(1);
}
if (!apiKey) {
  console.error('Missing RESEND_API_KEY. Create one at https://resend.com and rerun.');
  process.exit(1);
}
if (!from || !from.includes('@')) {
  console.error('Missing SMTP_FROM (e.g. auth@wildriftforge.com) on a domain verified in Resend.');
  process.exit(1);
}

const ref = new URL(supabaseUrl).hostname.split('.')[0];
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'SupabaseCLI/2.0',
  },
  body: JSON.stringify({
    smtp_admin_email: from,
    smtp_host: 'smtp.resend.com',
    smtp_port: '465',
    smtp_user: 'resend',
    smtp_pass: apiKey,
    smtp_sender_name: 'Wild Rift Forge',
  }),
});

if (!res.ok) {
  const text = (await res.text()).replaceAll(token, '[redacted]').replaceAll(apiKey, '[redacted]');
  console.error(`SMTP update failed (${res.status}): ${text.slice(0, 500)}`);
  process.exit(1);
}

console.log(`Custom SMTP (Resend) enabled on project ${ref} as ${from}.`);
console.log('Next: node scripts/push-auth-email-templates.mjs');
