import { HomeHero } from '@/components/HomeHero';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchLatestPatch, fetchTiers } from '@/lib/api';
import { HERO_FALLBACK, splashFor, withRoster } from '@/lib/champions';
import { mostPicked, mostPickedByLane, rosterBySlug } from '@/lib/placements';

export default async function HomePage() {
  const [roster, tiers, patch] = await Promise.all([
    fetchChampions(),
    fetchTiers(),
    fetchLatestPatch(),
  ]);
  const champions = withRoster(roster);
  const bySlug = rosterBySlug(champions);
  const placements = tiers?.placements ?? [];
  const climbing = mostPicked(placements, 4);
  const laneLeaders = mostPickedByLane(placements);
  const popular = mostPicked(placements, 5)
    .map((row) => bySlug.get(row.slug))
    .filter((champ): champ is NonNullable<typeof champ> => Boolean(champ));
  const popularList = popular.length > 0 ? popular : champions.slice(0, 5);
  const featured = climbing[0] ?? laneLeaders[0];
  const heroImage =
    splashFor(featured?.slug ?? '', bySlug.get(featured?.slug ?? '')?.imageUrl) ??
    champions.find((c) => c.imageUrl)?.imageUrl ??
    HERO_FALLBACK;

  return (
    <Shell pathname="/">
      <HomeHero
        champions={champions}
        popular={popularList}
        heroImage={heroImage}
        climbing={climbing}
        laneLeaders={laneLeaders}
        patchVersion={patch?.patch.version ?? null}
        patchNotes={patch?.champions ?? []}
      />
    </Shell>
  );
}
