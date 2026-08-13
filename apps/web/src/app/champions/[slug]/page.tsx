import { notFound } from 'next/navigation';
import { ChampionProfile } from '@/components/ChampionProfile';
import { Shell } from '@/components/Shell';
import { fetchChampion, fetchCounters, fetchLatestPatch, fetchTiers } from '@/lib/api';
import { FALLBACK_CHAMPIONS } from '@/lib/champions';
import { parseTierLane, placementsForSlug } from '@/lib/placements';

export default async function ChampionProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lane?: string }>;
}) {
  const { slug } = await params;
  const { lane: laneParam } = await searchParams;
  const lane = parseTierLane(laneParam);
  const [patch, tiers] = await Promise.all([fetchLatestPatch(), fetchTiers()]);
  const patchNote = patch?.champions.find((row) => row.slug === slug.toLowerCase()) ?? null;
  const champion =
    (await fetchChampion(slug)) ??
    FALLBACK_CHAMPIONS.find((c) => c.slug === slug.toLowerCase()) ??
    null;
  const resolvedSlug = champion?.slug ?? slug.toLowerCase();
  const placements = placementsForSlug(tiers?.placements ?? [], resolvedSlug);

  if (!champion) {
    const counters = await fetchCounters(slug, lane);
    if (!counters) notFound();
    return (
      <Shell pathname={`/champions/${slug}`}>
        <ChampionProfile
          slug={slug}
          name={counters.enemy.name}
          title={counters.enemy.title}
          roles={counters.enemy.roles}
          imageUrl={counters.enemy.imageUrl}
          thumbnailUrl={counters.enemy.thumbnailUrl}
          abilities={counters.abilities}
          counters={counters}
          patchNote={patchNote}
          placements={placements}
        />
      </Shell>
    );
  }

  const counters = await fetchCounters(champion.slug, lane);

  return (
    <Shell pathname={`/champions/${champion.slug}`}>
      <ChampionProfile
        slug={champion.slug}
        name={champion.name}
        title={champion.title}
        roles={champion.roles}
        imageUrl={champion.imageUrl}
        thumbnailUrl={champion.thumbnailUrl}
        abilities={champion.abilities}
        counters={counters}
        patchNote={patchNote}
        placements={placements}
      />
    </Shell>
  );
}
