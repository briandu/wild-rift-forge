import { Suspense } from 'react';
import { AccountView } from '@/components/AccountView';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchTiers } from '@/lib/api';

export default async function MePage() {
  const [champions, tiers] = await Promise.all([fetchChampions(), fetchTiers()]);
  return (
    <Shell pathname="/me">
      <Suspense fallback={null}>
        <AccountView champions={champions} placements={tiers?.placements ?? []} />
      </Suspense>
    </Shell>
  );
}
