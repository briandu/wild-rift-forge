import { MatchupView } from '@/components/MatchupView';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchMatchup } from '@/lib/api';

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<{ you?: string; them?: string; lane?: string }>;
}) {
  const params = await searchParams;
  const champions = await fetchChampions();
  const you = params.you || champions.find((c) => c.slug === 'garen')?.slug || champions[0]?.slug || 'garen';
  const them =
    params.them ||
    champions.find((c) => c.slug === 'darius')?.slug ||
    champions.find((c) => c.slug !== you)?.slug ||
    'darius';
  const lane = params.lane || 'Top';
  const matchup = await fetchMatchup(you, them, lane);

  return (
    <Shell pathname="/matchups">
      <MatchupView champions={champions} matchup={matchup} youSlug={you} themSlug={them} lane={lane} />
    </Shell>
  );
}
