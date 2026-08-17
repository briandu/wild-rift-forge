import { ChampionRoster } from '@/components/ChampionRoster';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchTiers } from '@/lib/api';
import { withRoster } from '@/lib/champions';
import { PAGE_COPY, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: PAGE_COPY.champions.title,
  description: PAGE_COPY.champions.description,
  path: '/champions',
});

export default async function ChampionsPage() {
  const [roster, tiers] = await Promise.all([fetchChampions(), fetchTiers()]);
  return (
    <Shell pathname="/champions">
      <ChampionRoster
        champions={withRoster(roster)}
        placements={tiers?.placements ?? []}
        sourceLabel={tiers?.sourceLabel ?? 'Diamond+ ranked stats'}
      />
    </Shell>
  );
}
