import { CounterResultsSkeleton } from '@/components/CounterResults';
import { Shell } from '@/components/Shell';

export default function Loading() {
  return (
    <Shell pathname="/counters" patchLabel="Patch">
      <CounterResultsSkeleton />
    </Shell>
  );
}
