import { ChampionRoster } from '@/components/ChampionRoster';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchTiers } from '@/lib/api';
import { withRoster } from '@/lib/champions';

export default async function ChampionsPage() {
  const [roster, tiers] = await Promise.all([fetchChampions(), fetchTiers()]);
  return (
    <Shell pathname="/champions">
      <ChampionRoster
        champions={withRoster(roster)}
        placements={tiers?.placements ?? []}
        patchVersion={tiers?.patchVersion ?? null}
        sourceLabel={tiers?.sourceLabel ?? 'CN Diamond+ ranked stats'}
      />
    </Shell>
  );
}
