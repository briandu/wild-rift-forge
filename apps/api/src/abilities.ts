import { abilityHotkey } from '@wild-rift-forge/game-data';
import { listChampionAbilities, type StoredChampionAbility } from '@wild-rift-forge/database';

export interface AbilityDto {
  key: string;
  name: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  cooldown?: Array<number | null>;
  cost?: { type: string; values: Array<number | null> };
  numericSummary?: string;
  snapshotPatch?: string;
}

export function toAbilityDtos(rows: StoredChampionAbility[]): AbilityDto[] {
  return rows.map((row) => ({
    key: abilityHotkey(row.slot),
    name: row.name,
    description: row.description ?? '',
    imageUrl: row.iconUrl ?? undefined,
    videoUrl: row.videoUrl ?? undefined,
    cooldown: row.cooldown ?? undefined,
    cost: row.cost ?? undefined,
    numericSummary: row.numericSummary ?? undefined,
    snapshotPatch: row.snapshotPatch ?? undefined,
  }));
}

export async function abilitiesForChampion(championId: number): Promise<AbilityDto[]> {
  return toAbilityDtos(await listChampionAbilities(championId));
}
