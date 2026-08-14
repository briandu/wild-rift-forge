import { DraftBoard } from '@/components/DraftBoard';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchIconSignatures, fetchTiers } from '@/lib/api';
import { portraitsFromRoster } from '@/lib/champions';
import { PAGE_COPY, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: PAGE_COPY.draft.title,
  description: PAGE_COPY.draft.description,
  path: '/draft',
});

export default async function DraftPage() {
  const [champions, tiers, icons] = await Promise.all([
    fetchChampions(),
    fetchTiers(),
    fetchIconSignatures(),
  ]);
  const portraits = portraitsFromRoster(champions);
  return (
    <Shell pathname="/draft">
      <DraftBoard
        champions={champions}
        portraits={portraits}
        placements={tiers?.placements ?? []}
        signatures={icons.signatures}
      />
    </Shell>
  );
}
