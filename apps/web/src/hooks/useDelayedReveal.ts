'use client';

import { useEffect, useRef, useState } from 'react';
import { holdRemainingMs, SKELETON_SHOW_MS } from '@/lib/loading';

export function useDelayedReveal(active: boolean): boolean {
  const [shown, setShown] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    let timer: number | undefined;

    if (active) {
      if (shownAtRef.current != null) {
        setShown(true);
        return;
      }
      timer = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setShown(true);
      }, SKELETON_SHOW_MS);
      return () => window.clearTimeout(timer);
    }

    if (shownAtRef.current == null) {
      setShown(false);
      return;
    }

    timer = window.setTimeout(
      () => {
        shownAtRef.current = null;
        setShown(false);
      },
      holdRemainingMs(Date.now() - shownAtRef.current),
    );
    return () => window.clearTimeout(timer);
  }, [active]);

  return shown;
}
