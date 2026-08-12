import { notFound } from 'next/navigation';
import { CounterResults } from '@/components/CounterResults';
import { Shell } from '@/components/Shell';
import { fetchCounters } from '@/lib/api';

export default async function CountersPage({
  params,
}: {
  params: Promise<{ champion: string }>;
}) {
  const { champion } = await params;
  const data = await fetchCounters(champion);
  if (!data) notFound();

  return (
    <Shell pathname={`/counters/${champion}`}>
      <CounterResults data={data} />
    </Shell>
  );
}
