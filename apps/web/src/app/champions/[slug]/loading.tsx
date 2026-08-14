import { ChampionProfileSkeleton } from '@/components/ChampionProfile';
import { Shell } from '@/components/Shell';

export default function Loading() {
  return (
    <Shell pathname="/champions" patchLabel="Patch">
      <ChampionProfileSkeleton />
    </Shell>
  );
}
