import { MatchupView } from '@/components/MatchupView';
import { Shell } from '@/components/Shell';
import { fetchChampions } from '@/lib/api';

export default async function MatchupsPage() {
  return (
    <Shell pathname="/matchups">
      <MatchupView champions={await fetchChampions()} />
    </Shell>
  );
}
