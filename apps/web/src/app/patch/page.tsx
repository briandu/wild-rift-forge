import { PatchNotes } from '@/components/PatchNotes';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchLatestPatch } from '@/lib/api';
import { portraitsFromRoster } from '@/lib/champions';

export default async function PatchPage() {
  const [roster, patch] = await Promise.all([fetchChampions(), fetchLatestPatch()]);
  return (
    <Shell pathname="/patch">
      <PatchNotes portraits={portraitsFromRoster(roster)} data={patch} />
    </Shell>
  );
}
