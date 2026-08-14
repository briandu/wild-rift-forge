import { after } from 'next/server';
import { TIER_LANES, type TierLane } from '@wild-rift-forge/game-data';
import { ensureMatchupGuide } from '@wild-rift-forge/api/generate-matchup';
import { MatchupView } from '@/components/MatchupView';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchMatchup } from '@/lib/api';

function asLane(value: string): TierLane {
  return TIER_LANES.includes(value as TierLane) ? (value as TierLane) : 'Top';
}

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
  if (matchup && !matchup.guide && you !== them) {
    after(() =>
      ensureMatchupGuide({ you, them, lane: asLane(matchup.lane) }).catch((err) => {
        console.warn('ensureMatchupGuide failed:', err instanceof Error ? err.message : err);
      }),
    );
  }

  return (
    <Shell pathname="/matchups">
      <MatchupView champions={champions} matchup={matchup} youSlug={you} themSlug={them} lane={lane} />
    </Shell>
  );
}
