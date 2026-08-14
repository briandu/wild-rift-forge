'use client';

import { RouteError } from '@/components/RouteError';

export default function Error({ reset }: { reset: () => void }) {
  return <RouteError title="Champion data did not load" reset={reset} />;
}
