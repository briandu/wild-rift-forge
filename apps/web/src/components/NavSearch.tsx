import { fetchChampions } from '@/lib/api';
import { withRoster } from '@/lib/champions';
import { ChampionSearch } from './ChampionSearch';

export async function NavSearch() {
  const champions = withRoster(await fetchChampions());
  return <ChampionSearch champions={champions} variant="compact" />;
}
