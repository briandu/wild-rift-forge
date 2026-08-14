import type { CheerioAPI } from 'cheerio';
import type { ResourceType } from '@wild-rift-forge/game-data';
import type { RawStatRow } from './types';

function parseNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === '') {
    return null;
  }
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseStatRows($: CheerioAPI): RawStatRow[] {
  const rows: RawStatRow[] = [];
  $('.statsBlock.champion .statsBlock__block').each((_, element) => {
    const label = $(element).find('.name').first().text().replace(/\s+/g, ' ').trim();
    const value = $(element).find('.value').first();
    const base = parseNumber(value.attr('data-base') ?? value.text());
    const perLevel = parseNumber(value.attr('data-increase'));
    if (!label) {
      return;
    }
    rows.push({ label, base, perLevel });
  });
  return rows;
}

export function resourceHintFromStats(rows: RawStatRow[]): ResourceType {
  const labels = rows.map((row) => row.label.toLowerCase());
  if (labels.some((label) => label.includes('energy'))) {
    return 'energy';
  }
  if (labels.some((label) => /\bmana\b/.test(label))) {
    return 'mana';
  }
  return 'none';
}
