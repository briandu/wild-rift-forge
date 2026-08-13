import { Suspense } from 'react';
import { AccountView } from '@/components/AccountView';
import { Shell } from '@/components/Shell';
import { fetchChampions } from '@/lib/api';

export default async function MePage() {
  return (
    <Shell pathname="/me">
      <Suspense fallback={null}>
        <AccountView champions={await fetchChampions()} />
      </Suspense>
    </Shell>
  );
}
