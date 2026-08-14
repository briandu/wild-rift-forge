import { Suspense } from 'react';
import { HomeHero, HomeLive, HomeLiveSkeleton } from '@/components/HomeHero';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchLatestPatch, fetchTiers } from '@/lib/api';
import { HERO_FALLBACK, splashFor, withRoster } from '@/lib/champions';
import { mostPicked, mostPickedByLane } from '@/lib/placements';
import { SITE_DESCRIPTION, SITE_TITLE, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  path: '/',
  absoluteTitle: true,
});

export default async function HomePage() {
  const roster = await fetchChampions();
  const champions = withRoster(roster);
  const popular = champions.slice(0, 5);
  const heroImage =
    splashFor(popular[0]?.slug ?? '', popular[0]?.imageUrl) ??
    champions.find((c) => c.imageUrl)?.imageUrl ??
    HERO_FALLBACK;

  return (
    <Shell pathname="/">
      <HomeHero champions={champions} popular={popular} heroImage={heroImage}>
        <Suspense fallback={<HomeLiveSkeleton />}>
          <HomeLiveSection champions={champions} />
        </Suspense>
      </HomeHero>
    </Shell>
  );
}

async function HomeLiveSection({
  champions,
}: {
  champions: ReturnType<typeof withRoster>;
}) {
  const [tiers, patch] = await Promise.all([fetchTiers(), fetchLatestPatch()]);
  const placements = tiers?.placements ?? [];
  const climbing = mostPicked(placements, 4);
  const laneLeaders = mostPickedByLane(placements);

  return (
    <HomeLive
      champions={champions}
      climbing={climbing}
      laneLeaders={laneLeaders}
      patchVersion={patch?.patch.version ?? null}
      patchNotes={patch?.champions ?? []}
    />
  );
}
