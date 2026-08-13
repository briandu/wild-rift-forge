import { Shell } from '@/components/Shell';
import { TierList } from '@/components/TierList';
import { fetchChampions, fetchTiers } from '@/lib/api';
import { portraitsFromRoster } from '@/lib/champions';

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
        sourceLabel={tiers?.sourceLabel ?? 'CN Diamond+ ranked stats'}
      />
    </Shell>
  );
}
