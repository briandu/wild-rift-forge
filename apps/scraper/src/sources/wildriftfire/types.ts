import type { ResourceType, WrfAbilitySlot } from '@wild-rift-forge/game-data';

export interface RawStatRow {
  label: string;
  base: number | null;
  perLevel: number | null;
}

export interface RawAbilityBlock {
  slotKey: string;
  slot: WrfAbilitySlot | null;
  name: string;
  form: string | null;
  iconUrl: string | null;
  cooldown: Array<number | null> | null;
  costValues: Array<number | null> | null;
  paragraphs: string[];
  sourceText: string;
}

export interface RawChampionPage {
  id: string;
  name: string;
  title: string | null;
  imageUrl: string | null;
  positions: string[];
  observedPatch: string | null;
  stats: RawStatRow[];
  abilities: RawAbilityBlock[];
  resourceHint: ResourceType;
}
