import { MatchupHeroSkeleton } from '@/components/MatchupView';
import { Shell } from '@/components/Shell';

export default function Loading() {
  return (
    <Shell pathname="/matchups" patchLabel="Patch">
      <MatchupHeroSkeleton />
    </Shell>
  );
}
