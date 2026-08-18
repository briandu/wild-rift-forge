import { DraftSpectator } from '@/components/DraftSpectator';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchTiers } from '@/lib/api';
import { portraitsFromRoster } from '@/lib/champions';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Shared draft',
  description: 'Watch a live Wild Rift Forge draft board.',
  path: '/draft',
});

export default async function SharedDraftPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [champions, tiers] = await Promise.all([fetchChampions(), fetchTiers()]);
  return (
    <Shell pathname="/draft">
      <DraftSpectator
        token={token}
        champions={champions}
        portraits={portraitsFromRoster(champions)}
        placements={tiers?.placements ?? []}
      />
    </Shell>
  );
}
