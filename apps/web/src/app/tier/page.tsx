import { Shell } from '@/components/Shell';
import { TierList } from '@/components/TierList';
import { fetchChampions, fetchTiers } from '@/lib/api';
import { portraitsFromRoster } from '@/lib/champions';
import { PAGE_COPY, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: PAGE_COPY.tier.title,
  description: PAGE_COPY.tier.description,
  path: '/tier',
});

export default async function TierPage() {
  const [roster, tiers] = await Promise.all([fetchChampions(), fetchTiers()]);
  const portraits = portraitsFromRoster(roster);
  return (
    <Shell pathname="/tier">
      <TierList
        portraits={portraits}
        placements={tiers?.placements ?? []}
        patchVersion={tiers?.patchVersion ?? null}
        snapshotDate={tiers?.snapshotDate ?? null}
        sourceLabel={tiers?.sourceLabel ?? 'Diamond+ ranked stats'}
      />
    </Shell>
  );
}
