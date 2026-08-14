import { Shell } from '@/components/Shell';
import { TierListSkeleton } from '@/components/TierList';

export default function Loading() {
  return (
    <Shell pathname="/tier" patchLabel="Patch">
      <TierListSkeleton />
    </Shell>
  );
}
