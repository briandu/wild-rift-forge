import { abilityHotkey } from '@wild-rift-forge/game-data';
import { listChampionAbilities } from '@wild-rift-forge/database';

export interface AbilityDto {
  key: string;
  name: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
}

export async function abilitiesForChampion(championId: number): Promise<AbilityDto[]> {
  const rows = await listChampionAbilities(championId);
  return rows.map((row) => ({
    key: abilityHotkey(row.slot),
    name: row.name,
    description: row.description ?? '',
    imageUrl: row.iconUrl ?? undefined,
    videoUrl: row.videoUrl ?? undefined,
  }));
}
