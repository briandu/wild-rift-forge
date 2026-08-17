'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { TierPlacementDto } from '@/lib/api-types';
import { skeletonDelay } from '@/lib/loading';
import { TIER_DEFS } from '@/lib/tier-bands';
import { useAbilityTip } from './AbilityTip';
import { ChampFace } from './ChampFace';
import { LaneGlyph } from './LaneGlyph';
import styles from './TierList.module.css';

const ROLES = ['All', 'Top', 'Jungle', 'Mid', 'Dragon', 'Support'] as const;

function formatSnapshot(snapshotDate: string | null): string {
  if (!snapshotDate) {
    return '—';
  }
  const [year, month, day] = snapshotDate.split('-');
  if (!year || !month || !day) {
    return snapshotDate;
  }
  return `${Number(day)} ${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][Number(month) - 1]}`;
}

export function TierList({
  portraits = {},
  placements = [],
  patchVersion,
  snapshotDate,
  sourceLabel,
}: {
  portraits?: Record<string, string>;
  placements?: TierPlacementDto[];
  patchVersion: string | null;
  snapshotDate: string | null;
  sourceLabel: string;
}) {
  const [role, setRole] = useState<(typeof ROLES)[number]>('All');
  const tip = useAbilityTip();

  const pool = useMemo(() => {
    const filtered =
      role === 'All' ? placements : placements.filter((row) => row.lane === role);
    if (role !== 'All') {
      return [...filtered].sort((a, b) => b.score - a.score);
    }
    const best = new Map<string, TierPlacementDto>();
    for (const row of filtered) {
      const current = best.get(row.slug);
      if (!current || row.score > current.score) {
        best.set(row.slug, row);
      }
    }
    return [...best.values()].sort((a, b) => b.score - a.score);
  }, [placements, role]);

  const bands = useMemo(() => {
    return TIER_DEFS.map((tier) => ({
      ...tier,
      champs: pool.filter((row) => row.letter === tier.letter),
    }));
  }, [pool]);

  const sCount = bands[0]?.champs.length ?? 0;
  const rankedCount = new Set(placements.map((row) => row.slug)).size;

  return (
    <div>
      <div className={styles.hero}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.heroInner}>
          <div>
            <p className={styles.eyebrow}>
              {sourceLabel.replace(/^CN\s+/i, '').replace(/ ranked stats/i, '').toUpperCase()}
            </p>
            <h1 className={styles.title}>Tier list</h1>
            <p className={styles.copy}>
              Every champion ranked from {sourceLabel.toLowerCase()}. Pick a lane to see who is
              worth first-picking there.
            </p>
          </div>
          <div className={styles.stats}>
            <div>
              <div className={styles.statValue}>{rankedCount}</div>
              <div className={styles.statLabel}>CHAMPIONS RANKED</div>
            </div>
            <div>
              <div className={styles.statValue} style={{ color: 'var(--success)' }}>
                {sCount}
              </div>
              <div className={styles.statLabel}>IN S+ TIER</div>
            </div>
            <div>
              <div className={styles.statValue}>{formatSnapshot(snapshotDate)}</div>
              <div className={styles.statLabel}>STATS AS OF</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <div className={`${styles.roles} xfade`} role="tablist" aria-label="Lane filter">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={role === r}
                className={role === r ? styles.roleActive : styles.role}
                onClick={() => setRole(r)}
              >
                <LaneGlyph lane={r} />
                {r}
              </button>
            ))}
          </div>
          <div className={styles.count}>
            {pool.length} champions · {role === 'All' ? 'all lanes' : `${role} lane`}
          </div>
        </div>

        <div className={styles.bands}>
          {bands.map((band) => (
            <div
              key={band.letter}
              className={styles.band}
              style={{ borderColor: band.bd, background: band.rowbg }}
            >
              <div className={styles.badge} style={{ background: band.badgebg, borderColor: band.bd }}>
                <div
                  className={band.letter.length > 1 ? styles.letterWide : styles.letter}
                  style={{ color: band.c }}
                >
                  {band.letter}
                </div>
                <div className={styles.badgeLabel} style={{ color: band.c }}>
                  {band.label}
                </div>
                <div className={styles.badgeCount}>
                  {band.champs.length} champ{band.champs.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className={styles.champs}>
                {band.champs.length === 0 ? (
                  <div className={styles.empty}>
                    {placements.length === 0
                      ? 'No ranked snapshot yet. Run scrape:stats to ingest ranked rates.'
                      : 'No champions in this tier for the lane you picked.'}
                  </div>
                ) : (
                  <div className={styles.grid}>
                    {band.champs.map((champ) => (
                      <Link
                        key={`${champ.slug}-${champ.lane}`}
                        href={`/champions/${champ.slug}`}
                        className={styles.champ}
                        onMouseEnter={(event) => {
                          if (!champ.why) {
                            return;
                          }
                          tip.open(event, {
                            id: `${champ.slug}-${champ.lane}`,
                            slot: `${champ.letter} TIER · ${champ.lane.toUpperCase()}`,
                            name: champ.name,
                            text: champ.why,
                            letter: champ.letter,
                            imageUrl: portraits[champ.slug] ?? champ.thumbnailUrl ?? undefined,
                          });
                        }}
                        onMouseLeave={tip.close}
                      >
                        <span className={styles.ring} style={{ borderColor: band.bd }}>
                          <ChampFace
                            name={champ.name}
                            slug={champ.slug}
                            size={54}
                            portraits={portraits}
                          />
                        </span>
                        <span className={styles.champName}>{champ.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <p>Tiers weight win rate by how often a champion is played, then adjust for skill bracket and recent patch changes.</p>
          <Link href="/patch" className={styles.patchLink}>
            {patchVersion ? `See what changed in ${patchVersion}` : 'See patch notes'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function TierListSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading tier list</p>
      <div className={styles.hero}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.heroInner}>
          <div>
            <span data-skel="2" className={`skel-text ${styles.eyebrow}`}>
              DIAMOND+
            </span>
            <span data-skel="1" className={`skel-text ${styles.title}`}>
              Tier list
            </span>
            <span data-skel="3" className={`skel-text ${styles.copy}`}>
              Every champion ranked from diamond plus ranked stats.
            </span>
          </div>
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.bands}>
          {TIER_DEFS.map((band) => (
            <div
              key={band.letter}
              className={styles.band}
              style={{ borderColor: band.bd, background: band.rowbg }}
            >
              <div className={styles.badge} style={{ background: band.badgebg, borderColor: band.bd }}>
                <div
                  className={band.letter.length > 1 ? styles.letterWide : styles.letter}
                  style={{ color: band.c }}
                >
                  {band.letter}
                </div>
                <div className={styles.badgeLabel} style={{ color: band.c }}>
                  {band.label}
                </div>
              </div>
              <div className={styles.champs}>
                <div className={styles.grid}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className={styles.champ}>
                      <span
                        data-skel="1"
                        className={styles.skelFace}
                        style={{ animationDelay: skeletonDelay(i) }}
                      />
                      <span
                        data-skel="2"
                        className={styles.skelChampName}
                        style={{ animationDelay: skeletonDelay(i) }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
