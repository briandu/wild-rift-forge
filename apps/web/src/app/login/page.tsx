import { Suspense } from 'react';
import { AuthPanel } from '@/components/AuthPanel';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchLatestPatch, fetchTiers } from '@/lib/api';

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
