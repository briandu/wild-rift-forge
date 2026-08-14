import { createHash } from 'node:crypto';
import {
  getLatestPatch,
  getLatestSnapshotDate,
  getPatchAnalysis,
  getPatchByVersion,
  getPreviousSnapshotDate,
  listChampions,
  listPatchChanges,
  listWinRatesByChampion,
  upsertPatchAnalysis,
} from '@wild-rift-forge/database';
import type { PatchAnalysisPayload } from '@wild-rift-forge/game-data';
import { matchHeroToRoster } from '../sources/tencent/hero-map';

const MODEL = 'gpt-4o-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const ANALYSIS_SCHEMA = {
  name: 'patch_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['lede', 'watch', 'movers'],
    properties: {
      lede: { type: 'string' },
      watch: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['slug', 'why'],
          properties: {
            slug: { type: 'string' },
            why: { type: 'string' },
          },
        },
      },
      movers: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['slug', 'direction', 'note'],
          properties: {
            slug: { type: 'string' },
            direction: { type: 'string', enum: ['up', 'down'] },
            note: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

export interface AnalyzePatchResult {
  version: string;
  status: 'written' | 'updated' | 'skipped' | 'missing-key';
}

export interface PatchNoteFingerprintInput {
  version: string;
  title: string;
  champions: Array<{ slug: string; name: string; changes: string[] }>;
  items: string[];
}

/** Stable hash of stored patch-note facts. Live win rates are excluded. */
export function fingerprintPatchNotes(input: PatchNoteFingerprintInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: input.version,
        title: input.title,
        champions: input.champions,
        items: input.items,
      }),
    )
    .digest('hex');
}

export function analysisIsCurrent(existingHash: string | undefined, nextHash: string): boolean {
  return existingHash === nextHash;
}

function parsePayload(raw: unknown, allowedSlugs: Set<string>): PatchAnalysisPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('OpenAI returned a non-object analysis payload');
  }
  const body = raw as Record<string, unknown>;
  const lede = typeof body.lede === 'string' ? body.lede.trim() : '';
  if (!lede) {
    throw new Error('OpenAI analysis was missing a lede');
  }
  const watchRaw = Array.isArray(body.watch) ? body.watch : [];
  const moversRaw = Array.isArray(body.movers) ? body.movers : [];
  return {
    lede,
    watch: watchRaw.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }
      const row = item as { slug?: unknown; why?: unknown };
      const slug = typeof row.slug === 'string' ? row.slug : '';
      const why = typeof row.why === 'string' ? row.why : '';
      if (!allowedSlugs.has(slug) || !why) {
        return [];
      }
      return [{ slug, why }];
    }),
    movers: moversRaw.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }
      const row = item as { slug?: unknown; direction?: unknown; note?: unknown };
      const slug = typeof row.slug === 'string' ? row.slug : '';
      const direction = row.direction === 'up' || row.direction === 'down' ? row.direction : null;
      const note = typeof row.note === 'string' ? row.note : '';
      if (!allowedSlugs.has(slug) || !direction || !note) {
        return [];
      }
      return [{ slug, direction, note }];
    }),
  };
}

async function completeAnalysis(prompt: string, apiKey: string): Promise<unknown> {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You write short Wild Rift patch commentary for a strategy site. Use only the facts in the user message. Do not invent win rates, pick rates, or tier letters. Do not assign S/A/B/C. Slugs must come from the provided champion list.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: ANALYSIS_SCHEMA,
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 429 && detail.includes('insufficient_quota')) {
      throw new Error(
        'OpenAI rejected the request: this API key has no remaining quota. Add billing at https://platform.openai.com/settings/organization/billing and re-run scrape:analyze-patch.',
      );
    }
    throw new Error(`OpenAI HTTP ${response.status}: ${detail.slice(0, 400)}`);
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response was missing message content');
  }
  return JSON.parse(content) as unknown;
}

export async function analyzePatch(version?: string): Promise<AnalyzePatchResult> {
  const patch = version ? await getPatchByVersion(version) : await getLatestPatch();
  if (!patch) {
    throw new Error(version ? `Patch ${version} is not stored` : 'No patches stored');
  }

  const existing = await getPatchAnalysis(patch.id);
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  const roster = await listChampions();
  const slugs = roster.map((champion) => champion.slug);
  const allowedSlugs = new Set(slugs);
  const changes = await listPatchChanges(patch.id);

  const championBlocks = new Map<
    string,
    { slug: string; name: string; lines: string[]; kinds: string[] }
  >();
  const itemLines: string[] = [];
  for (const change of changes) {
    if (change.entityType === 'item' || change.entityType === 'rune' || change.entityType === 'system') {
      const line = [change.entityName, change.ability, change.property, change.description]
        .filter(Boolean)
        .join(' — ');
      if (line) {
        itemLines.push(line);
      }
      continue;
    }
    const slug = matchHeroToRoster(change.entityName, slugs) ?? slugs.find((s) => s === change.entityName.toLowerCase());
    const key = slug ?? change.entityName;
    const current = championBlocks.get(key) ?? {
      slug: slug ?? '',
      name: change.entityName,
      lines: [],
      kinds: [],
    };
    current.kinds.push(change.changeType);
    const line = [change.changeType, change.ability, change.property, change.description]
      .filter(Boolean)
      .join(' · ');
    if (line) {
      current.lines.push(line);
    }
    championBlocks.set(key, current);
  }

  const noteChampions = [...championBlocks.values()].map((block) => ({
    slug: block.slug,
    name: block.name,
    changes: block.lines.slice(0, 8),
  }));
  const noteItems = itemLines.slice(0, 20);
  const promptHash = fingerprintPatchNotes({
    version: patch.version,
    title: patch.title,
    champions: noteChampions,
    items: noteItems,
  });

  if (analysisIsCurrent(existing?.promptHash, promptHash)) {
    console.log(`Patch ${patch.version} commentary is current. Skipping OpenAI.`);
    return { version: patch.version, status: 'skipped' };
  }

  if (!apiKey) {
    console.log('OPENAI_API_KEY is not set — skipping patch commentary.');
    return { version: patch.version, status: 'missing-key' };
  }

  const latestDate = await getLatestSnapshotDate('diamond_plus');
  const prevDate = latestDate ? await getPreviousSnapshotDate('diamond_plus', latestDate) : null;
  const latestRates = latestDate ? await listWinRatesByChampion(latestDate, 'diamond_plus') : new Map();
  const prevRates = prevDate ? await listWinRatesByChampion(prevDate, 'diamond_plus') : new Map();

  const championFacts = noteChampions.map((block) => {
    const rates = block.slug ? latestRates.get(block.slug) : undefined;
    const prev = block.slug ? prevRates.get(block.slug) : undefined;
    const wr =
      rates && prev
        ? `current Diamond+ WR ${rates.winRate.toFixed(1)}% (was ${prev.winRate.toFixed(1)}%)`
        : rates
          ? `current Diamond+ WR ${rates.winRate.toFixed(1)}% (no prior snapshot)`
          : 'no live win rate yet';
    return {
      slug: block.slug,
      name: block.name,
      wr,
      changes: block.changes,
    };
  });

  const prompt = [
    `Patch ${patch.version}: ${patch.title}`,
    `Write a 2–3 sentence lede, up to 4 champions to watch, and up to 4 movers.`,
    `Use only these facts. Champion slugs must be from this list: ${slugs.join(', ')}.`,
    '',
    'Champion changes:',
    JSON.stringify(championFacts, null, 2),
    '',
    'Item / system changes:',
    noteItems.join('\n') || '(none)',
  ].join('\n');

  const raw = await completeAnalysis(prompt, apiKey);
  const payload = parsePayload(raw, allowedSlugs);

  const written = await upsertPatchAnalysis({
    patchId: patch.id,
    model: MODEL,
    promptHash,
    payload,
  });
  if (written.updated) {
    console.log(`Updated analysis for patch ${patch.version} (${MODEL}) — notes changed.`);
    return { version: patch.version, status: 'updated' };
  }
  if (written.inserted) {
    console.log(`Stored analysis for patch ${patch.version} (${MODEL}).`);
    return { version: patch.version, status: 'written' };
  }
  console.log(`Patch ${patch.version} commentary is current. Skipping OpenAI.`);
  return { version: patch.version, status: 'skipped' };
}
