import { DraftBoard } from '@/components/DraftBoard';
import { Shell } from '@/components/Shell';
import { fetchChampions } from '@/lib/api';
import { portraitsFromRoster } from '@/lib/champions';

export default async function DraftPage() {
  const portraits = portraitsFromRoster(await fetchChampions());
  return (
    <Shell pathname="/draft">
      <DraftBoard portraits={portraits} />
    </Shell>
  );
}
