import { fetchChampions } from '@/lib/api';
import { withRoster } from '@/lib/champions';
import { ChampionSearch } from './ChampionSearch';

export async function NavSearch({ variant = 'compact' }: { variant?: 'compact' | 'overlay' }) {
  const champions = withRoster(await fetchChampions());
  return <ChampionSearch champions={champions} variant={variant} autoFocus={variant === 'overlay'} />;
}
