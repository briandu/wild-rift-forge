'use client';

import { RouteError } from '@/components/RouteError';

export default function Error({ reset }: { reset: () => void }) {
  return <RouteError title="Counter data did not load" reset={reset} />;
}
