import type { Cheerio, CheerioAPI, Element } from 'cheerio';
import type { WrfAbilitySlot } from '@wild-rift-forge/game-data';
import type { RawAbilityBlock } from './types';

const SLOT_BY_KEY: Record<string, WrfAbilitySlot> = {
  P: 'passive',
  p: 'passive',
  '1': 'q',
  '2': 'w',
  '3': 'e',
  '4': 'r',
  Q: 'q',
  W: 'w',
  E: 'e',
  R: 'r',
};

function parseRankSpans($: CheerioAPI, root: Cheerio<Element>): Array<number | null> | null {
  const values: Array<number | null> = [];
  root.find('span').each((_, element) => {
    const text = $(element).text().replace(/,/g, '').trim();
    if (!text) {
      return;
    }
    const parsed = Number(text);
    values.push(Number.isFinite(parsed) ? parsed : null);
  });
  return values.length > 0 ? values : null;
}

function cleanText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function splitForm(name: string): { name: string; form: string | null } {
  const match = name.match(/^(.*?)\s+[—–-]\s+(Shadow Assassin|Rhaast|Cougar|Human|Mecha|Mega|Mini)$/i);
  if (match?.[1] && match[2]) {
    return { name: match[1].trim(), form: match[2] };
  }
  return { name, form: null };
}

export function parseAbilityBlocks($: CheerioAPI): RawAbilityBlock[] {
  const blocks: RawAbilityBlock[] = [];
  $('.statsBlock.abilities .statsBlock__block').each((_, element) => {
    const block = $(element);
    const slotKey = block.find('.name span').first().text().trim();
    const rawName = block.find('.name').first().text().replace(slotKey, '').replace(/\s+/g, ' ').trim();
    const { name, form } = splitForm(rawName);
    const icon = block.find('.upper img').first().attr('src')?.trim() ?? null;
    const paragraphs = block
      .find('.lower p')
      .toArray()
      .map((node) => cleanText($(node).text()))
      .filter(Boolean);
    const sourceText = paragraphs.length > 0 ? paragraphs.join('\n\n') : cleanText(block.find('.lower').text());
    if (!name && !sourceText) {
      return;
    }
    blocks.push({
      slotKey,
      slot: SLOT_BY_KEY[slotKey] ?? null,
      name: name || slotKey || 'Unknown',
      form,
      iconUrl: icon,
      cooldown: parseRankSpans($, block.find('.cooldown')),
      costValues: parseRankSpans($, block.find('.cost')),
      paragraphs: paragraphs.length > 0 ? paragraphs : sourceText ? [sourceText] : [],
      sourceText,
    });
  });
  return blocks;
}
