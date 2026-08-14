import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CounterResults } from '@/components/CounterResults';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchCounters, fetchTiers } from '@/lib/api';
import { resolveChampionSlug } from '@/lib/champions';
import { parseTierLane, placementsForSlug } from '@/lib/placements';
import { preferredLaneOf } from '@/lib/roles';
import { countersDescription, countersTitle, nameFromRoster, pageMetadata } from '@/lib/seo';
import { loadViewerRoleOrder } from '@/lib/server/viewer';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ champion: string }>;
  searchParams: Promise<{ lane?: string }>;
}): Promise<Metadata> {
  const { champion } = await params;
  const { lane: laneParam } = await searchParams;
  const [champions, tiers, roleOrder] = await Promise.all([
    fetchChampions(),
    fetchTiers(),
    loadViewerRoleOrder(),
  ]);
  const slug = resolveChampionSlug(champion, champions) || champion;
  const explicit = parseTierLane(laneParam);
  const lanes = placementsForSlug(tiers?.placements ?? [], slug).map((row) => row.lane);
  const lane = explicit ?? preferredLaneOf(lanes, roleOrder);
  const data = await fetchCounters(slug, lane);
  const name = data?.enemy.name ?? nameFromRoster(champions, slug);
  return pageMetadata({
    title: countersTitle(name),
    description: countersDescription(name, data?.lane ?? lane),
    path: `/counters/${data?.enemy.slug ?? slug}`,
  });
}

export default async function CountersPage({
  params,
  searchParams,
}: {
  params: Promise<{ champion: string }>;
  searchParams: Promise<{ lane?: string }>;
}) {
  const { champion } = await params;
  const { lane: laneParam } = await searchParams;
  const [champions, tiers, roleOrder] = await Promise.all([
    fetchChampions(),
    fetchTiers(),
    loadViewerRoleOrder(),
  ]);
  const slug = resolveChampionSlug(champion, champions) || champion;
  const explicit = parseTierLane(laneParam);
  const lanes = placementsForSlug(tiers?.placements ?? [], slug).map((row) => row.lane);
  const lane = explicit ?? preferredLaneOf(lanes, roleOrder);
  const data = await fetchCounters(slug, lane);
  if (!data) notFound();

  return (
    <Shell pathname={`/counters/${champion}`}>
      <CounterResults data={data} />
    </Shell>
  );
}
