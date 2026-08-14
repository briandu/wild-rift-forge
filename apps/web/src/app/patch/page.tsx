import type { Metadata } from 'next';
import { PatchNotes } from '@/components/PatchNotes';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchLatestPatch } from '@/lib/api';
import { portraitsFromRoster } from '@/lib/champions';
import { pageMetadata, patchDescription, patchTitle } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const patch = await fetchLatestPatch();
  const version = patch?.patch.version ?? null;
  return pageMetadata({
    title: patchTitle(version),
    description: patchDescription(version),
    path: '/patch',
  });
}

export default async function PatchPage() {
  const [roster, patch] = await Promise.all([fetchChampions(), fetchLatestPatch()]);
  return (
    <Shell pathname="/patch">
      <PatchNotes portraits={portraitsFromRoster(roster)} data={patch} />
    </Shell>
  );
}
