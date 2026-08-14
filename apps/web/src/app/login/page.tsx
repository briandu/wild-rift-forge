import { Suspense } from 'react';
import { AuthPanel } from '@/components/AuthPanel';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchLatestPatch, fetchTiers } from '@/lib/api';
import { PAGE_COPY, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: PAGE_COPY.login.title,
  description: PAGE_COPY.login.description,
  path: '/login',
  index: false,
});

export default async function LoginPage() {
  const [champions, patch, tiers] = await Promise.all([
    fetchChampions(),
    fetchLatestPatch(),
    fetchTiers(),
  ]);
  return (
    <Shell pathname="/login" showChrome={false}>
      <Suspense>
        <AuthPanel
          patchVersion={patch?.patch.version ?? null}
          championCount={champions.length}
          snapshotDate={tiers?.snapshotDate ?? patch?.statsAsOf ?? null}
        />
      </Suspense>
    </Shell>
  );
}
