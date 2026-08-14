import type { Metadata } from 'next';
import { after } from 'next/server';
import { TIER_LANES, type TierLane } from '@wild-rift-forge/game-data';
import { ensureMatchupGuide } from '@wild-rift-forge/api/generate-matchup';
import { MatchupView } from '@/components/MatchupView';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchMatchup, fetchTiers, type TierPlacementDto } from '@/lib/api';
import { resolveChampionSlug } from '@/lib/champions';
import { parseTierLane, placementsForSlug } from '@/lib/placements';
import { normalizeRoleOrder, preferredLaneOf, preferredSharedLane } from '@/lib/roles';
import {
  PAGE_COPY,
  matchupDescription,
  matchupTitle,
  nameFromRoster,
  pageMetadata,
} from '@/lib/seo';
import { loadViewerRoleOrder } from '@/lib/server/viewer';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ you?: string; them?: string; lane?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  if (!params.you || !params.them) {
    return pageMetadata({
      title: PAGE_COPY.matchups.title,
      description: PAGE_COPY.matchups.description,
      path: '/matchups',
    });
  }
  const champions = await fetchChampions();
  const you = resolveChampionSlug(params.you, champions) || params.you;
  const them = resolveChampionSlug(params.them, champions) || params.them;
  const lane = parseTierLane(params.lane) ?? 'Top';
  const query = new URLSearchParams({ you, them, lane });
  return pageMetadata({
    title: matchupTitle(nameFromRoster(champions, you), nameFromRoster(champions, them), lane),
    description: matchupDescription(
      nameFromRoster(champions, you),
      nameFromRoster(champions, them),
      lane,
    ),
    path: `/matchups?${query}`,
  });
}

function asLane(value: string): TierLane {
  return TIER_LANES.includes(value as TierLane) ? (value as TierLane) : 'Top';
}

function laneForPair(
  you: string,
  them: string,
  placements: TierPlacementDto[],
  roleOrder: readonly string[],
): TierLane {
  const youLanes = you ? placementsForSlug(placements, you).map((row) => row.lane) : [];
  const themLanes = them ? placementsForSlug(placements, them).map((row) => row.lane) : [];
  if (you && them) return preferredSharedLane(youLanes, themLanes, roleOrder);
  if (you) return preferredLaneOf(youLanes, roleOrder) ?? parseTierLane(roleOrder[0]) ?? 'Top';
  if (them) return preferredLaneOf(themLanes, roleOrder) ?? parseTierLane(roleOrder[0]) ?? 'Top';
  return parseTierLane(roleOrder[0]) ?? 'Top';
}

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<{ you?: string; them?: string; lane?: string }>;
}) {
  const params = await searchParams;
  const [champions, tiers, roleOrder] = await Promise.all([
    fetchChampions(),
    fetchTiers(),
    loadViewerRoleOrder(),
  ]);
  const placements = tiers?.placements ?? [];
  const you = resolveChampionSlug(params.you, champions);
  const them = resolveChampionSlug(params.them, champions);
  const roles = normalizeRoleOrder(roleOrder);
  const lane = parseTierLane(params.lane) ?? laneForPair(you, them, placements, roles);
  const matchup = you && them ? await fetchMatchup(you, them, lane) : null;
  if (matchup && !matchup.guide && you !== them) {
    after(() =>
      ensureMatchupGuide({ you, them, lane: asLane(matchup.lane) }).catch((err) => {
        console.warn('ensureMatchupGuide failed:', err instanceof Error ? err.message : err);
      }),
    );
  }

  return (
    <Shell pathname="/matchups">
      <MatchupView
        champions={champions}
        matchup={matchup}
        youSlug={you}
        themSlug={them}
        lane={lane}
        placements={placements}
        roleOrder={roles}
      />
    </Shell>
  );
}
