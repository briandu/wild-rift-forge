'use client';

import Fuse, { type IFuseOptions } from 'fuse.js';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useDelayedReveal } from '@/hooks/useDelayedReveal';
import type { ApiChampion } from '@/lib/api-types';
import { initials, portraitFor, roleLabel } from '@/lib/champions';
import { SEARCH_DEBOUNCE_MS, skeletonDelay } from '@/lib/loading';
import styles from './ChampionSearch.module.css';

const SKEL_WIDTHS = [
  ['62%', '38%'],
  ['48%', '30%'],
  ['70%', '42%'],
] as const;

const FUSE_OPTIONS: IFuseOptions<ApiChampion> = {
  keys: [
    { name: 'name', weight: 2 },
    { name: 'slug', weight: 1 },
    { name: 'title', weight: 0.4 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 1,
};

export function ChampionSearch({
  champions,
  variant = 'hero',
  autoFocus = false,
}: {
  champions: ApiChampion[];
  variant?: 'hero' | 'compact' | 'mobile' | 'overlay';
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  const fuse = useMemo(() => new Fuse(champions, FUSE_OPTIONS), [champions]);
  const nearestFuse = useMemo(
    () => new Fuse(champions, { ...FUSE_OPTIONS, threshold: 0.8 }),
    [champions],
  );

  const q = query.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  const searching = q.length > 0 && q !== debouncedQ;
  const showSkel = useDelayedReveal(searching);
  const results = useMemo(
    () => (debouncedQ ? fuse.search(debouncedQ, { limit: 5 }).map((hit) => hit.item) : []),
    [fuse, debouncedQ],
  );
  const nearest = useMemo(
    () =>
      debouncedQ && results.length === 0
        ? nearestFuse.search(debouncedQ, { limit: 3 }).map((hit) => hit.item)
        : [],
    [nearestFuse, debouncedQ, results.length],
  );

  function go(slug: string) {
    router.push(`/counters/${slug}`);
    setQuery('');
  }

  function onSubmit() {
    const first = results[0];
    if (first) go(first.slug);
  }

  useEffect(() => {
    if (!q) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setQuery('');
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [q]);

  const open = q.length > 0;
  const panel = showSkel ? (
    <ul className={styles.results} role="status" aria-label="Loading search results">
      {SKEL_WIDTHS.map(([w1, w2], i) => (
        <li key={w1} className={styles.skelRow} style={{ animationDelay: skeletonDelay(i) }}>
          <span data-skel="1" className={styles.skelAvatar} style={{ animationDelay: skeletonDelay(i) }} />
          <span className={styles.skelCopy}>
            <span data-skel="2" className={styles.skelName} style={{ width: w1, animationDelay: skeletonDelay(i) }} />
            <span data-skel="3" className={styles.skelMeta} style={{ width: w2, animationDelay: skeletonDelay(i) }} />
          </span>
        </li>
      ))}
    </ul>
  ) : results.length > 0 ? (
      <ul className={styles.results} role="listbox">
        {results.map((c, i) => (
          <li key={c.slug}>
            <button
              type="button"
              className={i === 0 ? styles.resultActive : styles.result}
              onClick={() => go(c.slug)}
            >
              <span className={styles.avatar}>
                {portraitFor(c.slug, c.imageUrl, c.thumbnailUrl) ? (
                  <Image
                    src={portraitFor(c.slug, c.imageUrl, c.thumbnailUrl)!}
                    alt=""
                    width={38}
                    height={38}
                  />
                ) : (
                  <span>{initials(c.name)}</span>
                )}
              </span>
              <span className={styles.name}>{c.name}</span>
              <span className={styles.meta}>{roleLabel(c.roles)}</span>
            </button>
          </li>
        ))}
      </ul>
    ) : open && !searching && debouncedQ ? (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No champion matches &ldquo;{debouncedQ}&rdquo;</p>
        <p className={styles.emptyHint}>Check the spelling, or try one of these.</p>
        <div className={styles.nearest}>
          {(nearest.length > 0 ? nearest : champions.slice(0, 3)).map((c) => (
            <button key={c.slug} type="button" className={styles.nearestChip} onClick={() => go(c.slug)}>
              <span className={styles.avatarSm}>
                {portraitFor(c.slug, c.imageUrl, c.thumbnailUrl) ? (
                  <Image
                    src={portraitFor(c.slug, c.imageUrl, c.thumbnailUrl)!}
                    alt=""
                    width={24}
                    height={24}
                  />
                ) : (
                  <span>{initials(c.name)}</span>
                )}
              </span>
              {c.name}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  const wrapClass =
    variant === 'compact'
      ? styles.compactWrap
      : variant === 'mobile'
        ? styles.mobileWrap
        : variant === 'overlay'
          ? styles.overlayWrap
          : styles.heroWrap;
  const barClass =
    variant === 'compact'
      ? styles.compactBar
      : variant === 'mobile'
        ? styles.mobileBar
        : variant === 'overlay'
          ? styles.overlayBar
          : styles.heroBar;
  const placeholder =
    variant === 'mobile' || variant === 'overlay'
      ? 'Search a champion'
      : variant === 'hero'
        ? 'Search champion…'
        : 'Search champion';
  const iconSize = variant === 'compact' ? 15 : variant === 'overlay' ? 16 : 18;

  return (
    <div ref={wrapRef} className={wrapClass}>
      <div className={barClass}>
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent-soft)"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
          placeholder={placeholder}
          aria-label="Search champion"
          className={styles.input}
          autoFocus={autoFocus}
        />
        {variant === 'hero' ? (
          <button type="button" className={`${styles.cta} animate-cta`} onClick={onSubmit}>
            Counter
          </button>
        ) : null}
        {variant === 'mobile' && query ? (
          <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label="Clear search">
            ×
          </button>
        ) : null}
      </div>

      {variant === 'compact' ? (
        <FloatingPanel open={open} anchorRef={wrapRef} onDismiss={() => setQuery('')}>
          {panel}
        </FloatingPanel>
      ) : (
        panel
      )}
    </div>
  );
}

function FloatingPanel({
  open,
  anchorRef,
  onDismiss,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLDivElement | null>;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const el = anchorRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      const width = Math.max(r.width, 300);
      const left = Math.min(Math.max(12, r.right - width), window.innerWidth - width - 12);
      setPos({ top: r.bottom + 8, left, width });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onDismiss();
    }
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open, anchorRef, onDismiss]);

  if (!open || !pos || !children) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={styles.portalPanel}
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
      {children}
    </div>,
    document.body,
  );
}
