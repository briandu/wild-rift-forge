import { notFound } from 'next/navigation';
import { ChampionProfile } from '@/components/ChampionProfile';
import { Shell } from '@/components/Shell';
import { fetchChampion, fetchCounters } from '@/lib/api';
import { FALLBACK_CHAMPIONS } from '@/lib/champions';

export default async function ChampionProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const champion =
    (await fetchChampion(slug)) ??
    FALLBACK_CHAMPIONS.find((c) => c.slug === slug.toLowerCase()) ??
    null;

  if (!champion) {
    const counters = await fetchCounters(slug);
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
        />
      </Shell>
    );
  }

  const counters = await fetchCounters(champion.slug);

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
      />
    </Shell>
  );
}
