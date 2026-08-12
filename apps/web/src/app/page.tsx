import { HomeHero } from '@/components/HomeHero';
import { Shell } from '@/components/Shell';
import { fetchChampions } from '@/lib/api';
import { HERO_FALLBACK, withRoster } from '@/lib/champions';

export default async function HomePage() {
  const champions = withRoster(await fetchChampions());
  const popular = champions.slice(0, 5);
  const heroImage = champions.find((c) => c.imageUrl)?.imageUrl ?? HERO_FALLBACK;

  return (
    <Shell pathname="/">
      <HomeHero champions={champions} popular={popular} heroImage={heroImage} />
    </Shell>
  );
}
