'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState, type CSSProperties } from 'react';
import type { ApiChampion, TierPlacementDto } from '@/lib/api-types';
import { cardFocusFor } from '@/lib/banner-focus';
import { FACE_FALLBACK_BG, initials, roleLabel, splashFor } from '@/lib/champions';
import styles from './ChampionRoster.module.css';

const LANES = ['All', 'Top', 'Jungle', 'Mid', 'Dragon', 'Support'] as const;
const SORTS = ['A–Z', 'Win rate'] as const;

type LaneFilter = (typeof LANES)[number];
type SortMode = (typeof SORTS)[number];

const TIER_STYLE: Record<string, { c: string; bg: string; bd: string }> = {
  S: { c: '#8FEDB8', bg: 'rgba(8, 7, 14, 0.72)', bd: 'rgba(123, 224, 168, 0.5)' },
  A: { c: '#F0A87B', bg: 'rgba(8, 7, 14, 0.72)', bd: 'rgba(240, 168, 123, 0.5)' },
  B: { c: '#9FCBE4', bg: 'rgba(8, 7, 14, 0.72)', bd: 'rgba(255, 255, 255, 0.2)' },
  C: { c: '#8B87A8', bg: 'rgba(8, 7, 14, 0.72)', bd: 'rgba(255, 255, 255, 0.16)' },
};

function wrBarWidth(winRate: number): string {
  return `${Math.min(100, Math.max(0, (winRate - 42) * 7))}%`;
}

function formatWr(winRate: number): string {
  return `${winRate.toFixed(1)}%`;
}

function uniqueLanes(rows: TierPlacementDto[]): string[] {
  const seen = new Set<string>();
  const lanes: string[] = [];
  for (const row of rows) {
    if (!seen.has(row.lane)) {
      seen.add(row.lane);
      lanes.push(row.lane);
    }
  }
  return lanes;
}

export function ChampionRoster({
  champions,
  placements,
  sourceLabel,
}: {
  champions: ApiChampion[];
  placements: TierPlacementDto[];
  sourceLabel: string;
}) {
  const [query, setQuery] = useState('');
  const [lane, setLane] = useState<LaneFilter>('All');
  const [sort, setSort] = useState<SortMode>('A–Z');

  const bySlug = useMemo(() => {
    const map = new Map<string, TierPlacementDto[]>();
    for (const row of placements) {
      const list = map.get(row.slug) ?? [];
      list.push(row);
      map.set(row.slug, list);
    }
    return map;
  }, [placements]);

  const tiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = champions.filter((champ) => {
      if (q && !champ.name.toLowerCase().includes(q) && !champ.slug.includes(q)) {
        return false;
      }
      if (lane === 'All') return true;
      return (bySlug.get(champ.slug) ?? []).some((row) => row.lane === lane);
    });

    const decorated = filtered.map((champ) => {
      const rows = bySlug.get(champ.slug) ?? [];
      const placement =
        lane === 'All'
          ? rows.reduce<TierPlacementDto | undefined>(
              (best, row) => (!best || row.score > best.score ? row : best),
              undefined,
            )
          : rows.find((row) => row.lane === lane);
      const lanes = uniqueLanes(rows);
      const kind = roleLabel(champ.roles);
      const laneLabel = lane !== 'All' ? lane : lanes.length > 0 ? lanes.join(', ') : '';
      return {
        champ,
        placement,
        subtitle: laneLabel ? `${kind} · ${laneLabel}` : kind,
      };
    });

    decorated.sort((a, b) => {
      if (sort === 'Win rate') {
        const aw = a.placement?.winRate ?? -1;
        const bw = b.placement?.winRate ?? -1;
        if (bw !== aw) return bw - aw;
      }
      return a.champ.name.localeCompare(b.champ.name);
    });

    return decorated;
  }, [champions, bySlug, query, lane, sort]);

  const eyebrow = sourceLabel
    .replace(/^CN\s+/i, '')
    .replace(/ ranked stats/i, '')
    .toUpperCase();
  const emptyLabel = query.trim()
    ? `No champion called “${query.trim()}”`
    : 'Nothing in that lane yet';

  function resetFilters() {
    setQuery('');
    setLane('All');
  }

  return (
    <div>
      <div className={styles.hero}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.heroInner}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.title}>Champions</h1>
          </div>
          <div className={styles.heroTools}>
            <label className={styles.search}>
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7FDCFF"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter champions"
                aria-label="Filter champions"
              />
              {query ? (
                <button
                  type="button"
                  className={styles.clear}
                  onClick={() => setQuery('')}
                  aria-label="Clear filter"
                >
                  ×
                </button>
              ) : null}
            </label>
            <div className={`${styles.pills} xfade`} role="group" aria-label="Sort">
              {SORTS.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={sort === mode ? styles.pillActive : styles.pill}
                  onClick={() => setSort(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={`${styles.pills} xfade`} role="group" aria-label="Lane">
          {LANES.map((item) => (
            <button
              key={item}
              type="button"
              className={lane === item ? styles.pillActive : styles.pill}
              onClick={() => setLane(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <p className={styles.count}>
          {tiles.length} of {champions.length} champions
        </p>
      </div>

      <div className={styles.body}>
        {tiles.length > 0 ? (
          <div className={styles.grid}>
            {tiles.map(({ champ, placement, subtitle }) => {
              const art = splashFor(champ.slug, champ.imageUrl);
              const focus = cardFocusFor(champ.slug);
              const tier = placement ? TIER_STYLE[placement.letter] : null;
              return (
                <Link
                  key={champ.slug}
                  href={`/champions/${champ.slug}`}
                  className={styles.tile}
                  style={
                    {
                      background: FACE_FALLBACK_BG,
                      '--tier-c': tier?.c ?? '#8B87A8',
                      '--tier-bg': tier?.bg ?? 'rgba(8, 7, 14, 0.72)',
                      '--tier-bd': tier?.bd ?? 'rgba(255, 255, 255, 0.16)',
                      '--bar-w': placement ? wrBarWidth(placement.winRate) : '0%',
                    } as CSSProperties
                  }
                >
                  {art ? (
                    <Image
                      src={art}
                      alt=""
                      fill
                      className={styles.art}
                      style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
                      sizes="(max-width: 900px) 140vw, 640px"
                      quality={90}
                    />
                  ) : (
                    <span className={styles.ini} aria-hidden>
                      {initials(champ.name)}
                    </span>
                  )}
                  <span className={styles.fade} aria-hidden />
                  {placement ? <span className={styles.ribbon}>{placement.letter}</span> : null}
                  <span className={styles.meta}>
                    <span className={styles.name}>{champ.name}</span>
                    <span className={styles.role}>{subtitle}</span>
                    {placement ? (
                      <span className={styles.wrRow}>
                        <span className={styles.bar}>
                          <span className={styles.barFill} />
                        </span>
                        <span className={styles.wr}>{formatWr(placement.winRate)}</span>
                      </span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{emptyLabel}</p>
            <p className={styles.emptyCopy}>Check the spelling, or clear the lane filter.</p>
            <button type="button" className={styles.reset} onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
