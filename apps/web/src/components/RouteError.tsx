'use client';

import { FailedPanel } from './LoadState';
import styles from './RouteError.module.css';

export function RouteError({ title, reset }: { title: string; reset: () => void }) {
  return (
    <div className={styles.wrap}>
      <FailedPanel
        title={title}
        copy="Everything else on this page is current."
        onRetry={reset}
      />
    </div>
  );
}
