#!/usr/bin/env node
/**
 * Send pool-patch and tier-letter emails for users who opted in.
 *
 *   node scripts/send-account-alerts.mjs --kind=pool|tier|all [--dry-run]
 *
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and Resend (RESEND_API_KEY + SMTP_FROM).
 * Counter alerts are not sent — pairwise history is not ingested.
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

const kindArg = (process.argv.find((arg) => arg.startsWith('--kind=')) ?? '--kind=all').slice(7);
const dryRun = process.argv.includes('--dry-run');
if (!['pool', 'tier', 'all'].includes(kindArg)) {
  console.error('Use --kind=pool, --kind=tier, or --kind=all.');
  process.exit(1);
}

const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = env.RESEND_API_KEY;
const from = env.SMTP_FROM ?? env.RESEND_FROM;
const site = env.SITE_URL ?? 'https://www.wildriftforge.com';

if (!url || !service) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
if (!dryRun && (!apiKey || !from)) {
  console.error('Missing RESEND_API_KEY / SMTP_FROM. Pass --dry-run to only list recipients.');
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const template = readFileSync(path.join(root, 'supabase/templates/account-alert.html'), 'utf8');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });
}

function compact(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchSlug(name, roster) {
  const key = compact(name);
  const hit = roster.find(
    (champion) => compact(champion.slug) === key || compact(champion.name) === key,
  );
  return hit?.slug ?? null;
}

function wantsEmail(channel) {
  return channel !== 'Push';
}

async function listAuthEmails() {
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
  return new Map(users.map((user) => [user.id, user.email]));
}

async function claimDelivery(userId, kind, dedupeKey) {
  if (dryRun) return true;
  const { error } = await admin.from('alert_deliveries').insert({
    user_id: userId,
    kind,
    dedupe_key: dedupeKey,
  });
  if (!error) return true;
  if (error.code === '23505') return false;
  console.error(`dedupe insert failed for ${userId}: ${error.message}`);
  return false;
}

async function sendMail({ email, subject, html }) {
  if (dryRun) {
    console.log(`dry-run ${email} ${subject}`);
    return true;
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
      subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error(`send failed for ${email}: ${(await res.text()).slice(0, 200)}`);
    return false;
  }
  return true;
}

function renderAlert({
  preview,
  badge,
  eyebrow,
  title,
  lede,
  section,
  count,
  rows,
  ctaHref,
  ctaLabel,
}) {
  return template
    .replaceAll('{{PREVIEW}}', escapeHtml(preview))
    .replaceAll('{{BADGE}}', escapeHtml(badge))
    .replaceAll('{{EYEBROW}}', escapeHtml(eyebrow))
    .replaceAll('{{TITLE}}', escapeHtml(title))
    .replaceAll('{{LEDE}}', escapeHtml(lede))
    .replaceAll('{{SECTION}}', escapeHtml(section))
    .replaceAll('{{COUNT}}', escapeHtml(count))
    .replaceAll('{{ROWS}}', rows)
    .replaceAll('{{CTA_HREF}}', escapeHtml(ctaHref))
    .replaceAll('{{CTA_LABEL}}', escapeHtml(ctaLabel))
    .replaceAll('{{SITE}}', escapeHtml(site));
}

function rowHtml({ initial, name, badge, badgeColor, note }) {
  const bg = badgeColor === 'buff' ? '#132318' : badgeColor === 'nerf' ? '#231416' : '#17151F';
  const bd = badgeColor === 'buff' ? '#2E5A3C' : badgeColor === 'nerf' ? '#5A2E32' : '#2A2736';
  const fg = badgeColor === 'buff' ? '#8FEDB8' : badgeColor === 'nerf' ? '#E58B7B' : '#9FCBE4';
  return `<tr><td style="padding:0 0 10px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141220" style="background-color:#141220;border:1px solid #242235;border-radius:16px;">
      <tr><td style="padding:20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="46" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="42" height="42" bgcolor="#7FDCFF" align="center" valign="middle" style="background-color:#7FDCFF;border-radius:21px;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:#0B0A12;">${escapeHtml(initial)}</td>
            </tr></table>
          </td>
          <td width="14"></td>
          <td valign="top">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:#FFFFFF;">${escapeHtml(name)}</div>
            <div style="padding-top:8px;">
              <span style="background-color:${bg};border:1px solid ${bd};border-radius:14px;padding:5px 11px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:0.8px;color:${fg};">${escapeHtml(badge)}</span>
            </div>
            <div style="padding-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;line-height:1.55;color:#8B87A8;">${escapeHtml(note)}</div>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>`;
}

function changeKind(types) {
  if (types.length > 0 && types.every((type) => type === 'buff')) return 'BUFF';
  if (types.length > 0 && types.every((type) => type === 'nerf')) return 'NERF';
  return 'ADJUST';
}

const { data: profiles, error: profileError } = await admin
  .from('profiles')
  .select(
    'id, notify_pool, notify_tier, notify_channel, user_champion_pool(champion_slug)',
  );
if (profileError) {
  console.error(profileError.message);
  process.exit(1);
}

const { data: roster } = await admin.from('champions').select('id, slug, name');
const nameBySlug = new Map((roster ?? []).map((row) => [row.slug, row.name]));
const slugById = new Map((roster ?? []).map((row) => [row.id, row.slug]));
const emailById = await listAuthEmails();

let sent = 0;

if (kindArg === 'pool' || kindArg === 'all') {
  const { data: patch } = await admin
    .from('patches')
    .select('id, version, title')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: changes } = patch
    ? await admin
        .from('patch_changes')
        .select('entity_name, entity_type, change_type, description')
        .eq('patch_id', patch.id)
        .eq('entity_type', 'champion')
    : { data: [] };

  const bySlug = new Map();
  for (const change of changes ?? []) {
    const slug = matchSlug(change.entity_name ?? '', roster ?? []);
    if (!slug) continue;
    const current = bySlug.get(slug) ?? { types: [], notes: [] };
    current.types.push(change.change_type);
    if (change.description) current.notes.push(change.description);
    bySlug.set(slug, current);
  }

  const dedupeKey = patch ? `pool:${patch.version}` : null;
  for (const profile of profiles ?? []) {
    if (!profile.notify_pool || !wantsEmail(profile.notify_channel) || !patch || !dedupeKey) {
      continue;
    }
    const email = emailById.get(profile.id);
    if (!email) continue;
    const poolRows = profile.user_champion_pool;
    const slugs = Array.isArray(poolRows) ? poolRows.map((row) => row.champion_slug) : [];
    const hits = slugs.filter((slug) => bySlug.has(slug));
    if (hits.length === 0) continue;
    if (!(await claimDelivery(profile.id, 'pool', dedupeKey))) continue;

    const rows = hits
      .map((slug) => {
        const group = bySlug.get(slug);
        const kind = changeKind(group?.types ?? []);
        const name = nameBySlug.get(slug) ?? slug;
        return rowHtml({
          initial: name.slice(0, 1).toUpperCase(),
          name,
          badge: kind,
          badgeColor: kind === 'BUFF' ? 'buff' : kind === 'NERF' ? 'nerf' : 'adjust',
          note: (group?.notes ?? []).slice(0, 2).join(' ') || `Changed in patch ${patch.version}.`,
        });
      })
      .join('');

    const html = renderAlert({
      preview: `Patch ${patch.version} touched ${hits.length} champion${hits.length === 1 ? '' : 's'} in your pool.`,
      badge: `Patch ${patch.version}`,
      eyebrow: 'POOL ALERT',
      title: `${hits.length} change${hits.length === 1 ? '' : 's'} in your pool.`,
      lede: `Patch ${patch.version} named ${hits.map((slug) => nameBySlug.get(slug) ?? slug).join(', ')}.`,
      section: 'CHANGES IN YOUR POOL',
      count: `${hits.length} THIS PATCH`,
      rows,
      ctaHref: `${site}/patch`,
      ctaLabel: 'Open patch notes',
    });
    if (await sendMail({ email, subject: `Patch ${patch.version} — your pool moved`, html })) {
      sent += 1;
    }
  }
}

if (kindArg === 'tier' || kindArg === 'all') {
  const { data: latestRow } = await admin
    .from('champion_tier_placements')
    .select('snapshot_date')
    .eq('rank_bracket', 'diamond_plus')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const latest = latestRow?.snapshot_date ? String(latestRow.snapshot_date).slice(0, 10) : null;
  const { data: prevRow } = latest
    ? await admin
        .from('champion_tier_placements')
        .select('snapshot_date')
        .eq('rank_bracket', 'diamond_plus')
        .lt('snapshot_date', latest)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const previous = prevRow?.snapshot_date ? String(prevRow.snapshot_date).slice(0, 10) : null;

  if (!latest || !previous) {
    console.log('No previous Diamond+ snapshot to compare for tier alerts.');
  } else {
    const { data: placements } = await admin
      .from('champion_tier_placements')
      .select('snapshot_date, champion_id, lane, letter')
      .eq('rank_bracket', 'diamond_plus')
      .in('snapshot_date', [latest, previous]);

    const byDate = { [latest]: new Map(), [previous]: new Map() };
    for (const row of placements ?? []) {
      const date = String(row.snapshot_date).slice(0, 10);
      const slug = slugById.get(row.champion_id);
      if (!slug || !byDate[date]) continue;
      byDate[date].set(`${slug}:${row.lane}`, row.letter);
    }

    const dedupeKey = `tier:${latest}`;
    for (const profile of profiles ?? []) {
      if (!profile.notify_tier || !wantsEmail(profile.notify_channel)) continue;
      const email = emailById.get(profile.id);
      if (!email) continue;
      const poolRows = profile.user_champion_pool;
      const slugs = Array.isArray(poolRows) ? poolRows.map((row) => row.champion_slug) : [];
      const shifts = [];
      for (const slug of slugs) {
        for (const lane of ['Top', 'Jungle', 'Mid', 'Dragon', 'Support']) {
          const now = byDate[latest].get(`${slug}:${lane}`);
          const was = byDate[previous].get(`${slug}:${lane}`);
          if (!now || !was || now === was) continue;
          shifts.push({ slug, lane, was, now });
        }
      }
      if (shifts.length === 0) continue;
      if (!(await claimDelivery(profile.id, 'tier', dedupeKey))) continue;

      const rows = shifts
        .map((shift) => {
          const name = nameBySlug.get(shift.slug) ?? shift.slug;
          const up = 'SABC'.indexOf(shift.now) < 'SABC'.indexOf(shift.was);
          return rowHtml({
            initial: name.slice(0, 1).toUpperCase(),
            name: `${name} · ${shift.lane}`,
            badge: `${shift.was} → ${shift.now}`,
            badgeColor: up ? 'buff' : 'nerf',
            note: `${name} moved a full letter in ${shift.lane} on the ${latest} Diamond+ snapshot.`,
          });
        })
        .join('');

      const html = renderAlert({
        preview: `${shifts.length} tier letter shift${shifts.length === 1 ? '' : 's'} in your pool.`,
        badge: latest,
        eyebrow: 'TIER ALERT',
        title: `${shifts.length} letter shift${shifts.length === 1 ? '' : 's'} in your pool.`,
        lede: `Compared with the ${previous} snapshot. Only full S+/S/A/B/C moves, not decimal win-rate noise.`,
        section: 'LETTER SHIFTS',
        count: `${shifts.length} THIS SNAPSHOT`,
        rows,
        ctaHref: `${site}/tier`,
        ctaLabel: 'Open tier list',
      });
      if (
        await sendMail({
          email,
          subject: `Tier letters moved — ${latest}`,
          html,
        })
      ) {
        sent += 1;
      }
    }
  }
}

console.log(`${dryRun ? 'Listed' : 'Sent'} ${sent} alert(s). kind=${kindArg}.`);
