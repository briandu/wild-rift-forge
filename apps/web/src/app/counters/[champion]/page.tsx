import { notFound } from 'next/navigation';
import { CounterResults } from '@/components/CounterResults';
import { Shell } from '@/components/Shell';
import { fetchCounters } from '@/lib/api';
import { parseTierLane } from '@/lib/placements';

export default async function CountersPage({
  params,
  searchParams,
}: {
  params: Promise<{ champion: string }>;
  searchParams: Promise<{ lane?: string }>;
}) {
  const { champion } = await params;
  const { lane: laneParam } = await searchParams;
  const data = await fetchCounters(champion, parseTierLane(laneParam));
  if (!data) notFound();

  return (
    <Shell pathname={`/counters/${champion}`}>
      <CounterResults data={data} />
    </Shell>
  );
}
