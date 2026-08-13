#!/usr/bin/env node
/**
 * Push Auth email HTML from supabase/templates/ to the hosted project.
 * Does not change Site URL, SMTP, or confirmation settings.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-auth-email-templates.mjs
 *
 * Token: https://supabase.com/dashboard/account/tokens
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

const env = {
  ...parseEnvFile(path.join(root, '.env')),
  ...process.env,
};

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
const templatesDir = path.join(root, 'supabase', 'templates');

function html(name) {
  return readFileSync(path.join(templatesDir, name), 'utf8');
}

const body = {
  mailer_subjects_confirmation: 'Confirm your email — Wild Rift Forge',
  mailer_templates_confirmation_content: html('confirmation.html'),
  mailer_subjects_recovery: 'Reset your password — Wild Rift Forge',
  mailer_templates_recovery_content: html('recovery.html'),
  mailer_subjects_magic_link: 'Your Wild Rift Forge sign-in link',
  mailer_templates_magic_link_content: html('magic_link.html'),
  mailer_subjects_invite: "You're invited to Wild Rift Forge",
  mailer_templates_invite_content: html('invite.html'),
  mailer_subjects_email_change: 'Confirm your new email — Wild Rift Forge',
  mailer_templates_email_change_content: html('email_change.html'),
  mailer_subjects_reauthentication: "Confirm it's you — Wild Rift Forge",
  mailer_templates_reauthentication_content: html('reauthentication.html'),
};

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'User-Agent': 'SupabaseCLI/2.0',
};

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify(body),
});

if (!res.ok) {
  const text = (await res.text()).replaceAll(token, '[redacted]');
  console.error(`Auth config update failed (${res.status}): ${text.slice(0, 500)}`);
  process.exit(1);
}

console.log(`Updated Auth email templates on project ${ref}.`);
