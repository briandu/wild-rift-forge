'use client';

import { RouteError } from '@/components/RouteError';

export default function Error({ reset }: { reset: () => void }) {
  return <RouteError title="Matchup data did not load" reset={reset} />;
}
