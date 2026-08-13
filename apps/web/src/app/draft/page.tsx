import { DraftBoard } from '@/components/DraftBoard';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchTiers } from '@/lib/api';
import { portraitsFromRoster } from '@/lib/champions';

export default async function DraftPage() {
  const [champions, tiers] = await Promise.all([fetchChampions(), fetchTiers()]);
  const portraits = portraitsFromRoster(champions);
  return (
    <Shell pathname="/draft">
      <DraftBoard champions={champions} portraits={portraits} placements={tiers?.placements ?? []} />
    </Shell>
  );
}
