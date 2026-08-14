import { Suspense } from 'react';
import { AccountView } from '@/components/AccountView';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchTiers } from '@/lib/api';
import { PAGE_COPY, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: PAGE_COPY.account.title,
  description: PAGE_COPY.account.description,
  path: '/me',
  index: false,
});

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
