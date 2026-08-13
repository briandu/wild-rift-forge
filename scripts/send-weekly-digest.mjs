#!/usr/bin/env node
/**
 * Send the weekly digest to users with notify_digest = true.
 *
 *   RESEND_API_KEY=re_... SMTP_FROM=digest@yourdomain.com node scripts/send-weekly-digest.mjs
 *
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to read profiles/pool and auth emails.
 */
import { createClient } from '@supabase/supabase-js';
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

const env = {
  ...parseEnvFile(path.join(root, '.env')),
  ...parseEnvFile(path.join(root, 'apps/web/.env.local')),
  ...process.env,
};

const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = env.RESEND_API_KEY;
const from = env.SMTP_FROM ?? env.RESEND_FROM;
const site = env.SITE_URL ?? 'https://www.wildriftforge.com';
const dryRun = process.argv.includes('--dry-run');

if (!url || !service) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
if (!dryRun && (!apiKey || !from)) {
  console.error('Missing RESEND_API_KEY / SMTP_FROM. Pass --dry-run to only list recipients.');
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const template = readFileSync(path.join(root, 'supabase/templates/weekly-digest.html'), 'utf8');

const { data: profiles, error: profileError } = await admin
  .from('profiles')
  .select('id, riot_id, region, notify_digest, user_champion_pool(champion_slug)')
  .eq('notify_digest', true);
if (profileError) {
  console.error(profileError.message);
  process.exit(1);
}

const { data: patch } = await admin
  .from('patches')
  .select('id, version, title, release_date')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

const { data: changes } = patch
  ? await admin.from('patch_changes').select('entity_name, change_type, description').eq('patch_id', patch.id)
  : { data: [] };

const { data: roster } = await admin.from('champions').select('slug, name');
const nameBySlug = new Map((roster ?? []).map((row) => [row.slug, row.name]));

const users = [];
let page = 1;
for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  users.push(...data.users);
  if (data.users.length < 200) break;
  page += 1;
}

const emailById = new Map(users.map((user) => [user.id, user.email]));
const weekLabel = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'long' });
const patchVersion = patch?.version ?? 'latest';

function render(poolNames, email) {
  const blurb =
    poolNames.length > 0
      ? `Everything below touches your pool — ${poolNames.join(', ')}.`
      : 'Add a champion pool on your account to personalise this mail.';
  return template
    .replaceAll('Patch 6.2b', `Patch ${patchVersion}`)
    .replaceAll('WEEK OF 10 AUGUST', `WEEK OF ${weekLabel.toUpperCase()}`)
    .replaceAll(
      'Everything below touches your pool — Garen, Volibear, Renekton and Gwen. Nothing else moved enough to email you about.',
      blurb,
    )
    .replaceAll('https://wildriftforge.gg/matchups', `${site}/matchups`)
    .replaceAll('{{EMAIL}}', email);
}

let sent = 0;
for (const profile of profiles ?? []) {
  const email = emailById.get(profile.id);
  if (!email) continue;
  const poolRows = profile.user_champion_pool;
  const slugs = Array.isArray(poolRows) ? poolRows.map((row) => row.champion_slug) : [];
  const names = slugs.map((slug) => nameBySlug.get(slug) ?? slug);
  const html = render(names, email);
  if (dryRun) {
    console.log(`dry-run ${email} pool=${names.join('|') || '(empty)'}`);
    sent += 1;
    continue;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Wild Rift Forge <${from}>`,
      to: [email],
      subject: `Patch ${patchVersion} — your weekly Forge digest`,
      html,
    }),
  });
  if (!res.ok) {
    console.error(`send failed for ${email}: ${(await res.text()).slice(0, 200)}`);
    continue;
  }
  sent += 1;
}

console.log(`${dryRun ? 'Listed' : 'Sent'} ${sent} digest(s). Patch ${patchVersion}. Changes ${changes?.length ?? 0}.`);
