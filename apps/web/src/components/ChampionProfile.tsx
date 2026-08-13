'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { AbilityDto, CountersResponse, PatchChampionChangeDto } from '@/lib/api-types';
import { resolveAbilities } from '@/lib/abilities';
import { bannerFocusFor } from '@/lib/banner-focus';
import { ART_BY_SLUG, HERO_FALLBACK, initials, portraitFor, roleLabel } from '@/lib/champions';
import { AbilityStrip } from './AbilityStrip';
import styles from './ChampionProfile.module.css';

const TABS = ['Overview', 'Matchups', 'Builds', 'Skill order', 'Pro play'] as const;
const LANES = ['Top', 'Jungle', 'Mid', 'Dragon', 'Support'] as const;

export function ChampionProfile({
  slug,
  name,
  title,
  roles,
  imageUrl,
  thumbnailUrl,
  abilities: abilitiesProp,
  counters,
  patchNote,
}: {
  slug: string;
  name: string;
  title: string | null;
  roles: string[];
  imageUrl: string | null;
  thumbnailUrl?: string | null;
  abilities?: AbilityDto[] | null;
  counters: CountersResponse | null;
  patchNote?: PatchChampionChangeDto | null;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Matchups');
  const [dir, setDir] = useState<'beaten' | 'beats'>('beaten');
  const art = imageUrl || ART_BY_SLUG[slug] || HERO_FALLBACK;
  const focus = bannerFocusFor(slug);
  const avatar = portraitFor(slug, imageUrl, thumbnailUrl);
  const abilities = resolveAbilities(slug, abilitiesProp ?? counters?.abilities);
  const rows = counters
    ? dir === 'beaten'
      ? [...counters.picks, ...counters.also.map((c) => ({ ...c, why: 'Reliable pick into this lane' }))]
      : (counters.beats ?? counters.also.slice(0, 4)).map((c) => ({
          ...c,
          why: `Lower ${counters.lane.toLowerCase()} win rate than ${name}`,
          tag: 'GOOD COUNTER' as const,
        }))
    : [];

  return (
    <div>
      <section className={styles.hero}>
        <Image
          src={art}
          alt=""
          fill
          className={styles.heroArt}
          style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
          sizes="100vw"
          priority
          quality={90}
        />
        <div className={styles.heroFade} aria-hidden />
        <div className={styles.heroInner}>
          <div className={styles.heroLead}>
            <Link href="/champions" className={styles.back}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M14 6l-6 6 6 6" />
              </svg>
              All champions
            </Link>
            <div className={styles.identity}>
              <div className={styles.portrait}>
                {avatar ? (
                  <Image src={avatar} alt="" width={88} height={88} quality={90} />
                ) : (
                  initials(name)
                )}
              </div>
              <div>
                <h1 className={styles.name}>{name.toUpperCase()}</h1>
                <p className={styles.meta}>
                  {roleLabel(roles)}
                  {title ? ` · ${title}` : ''}
                  <span className={styles.tier}>A TIER</span>
                </p>
              </div>
            </div>
          </div>
          {counters ? (
            <div className={styles.stats}>
              {counters.stats.map((s) => (
                <div key={s.label}>
                  <div className={styles.statValue}>{s.value}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className={styles.heroAbilities}>
          <AbilityStrip abilities={abilities} size="lg" overlay />
        </div>
        <div className={styles.heroFooter}>
          <div className={styles.tabs} role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? styles.tabActive : styles.tab}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.body}>
        {tab === 'Overview' ? (
          <div className={styles.stubPanel}>
            <h2 className={styles.stubTitle}>Kit</h2>
            <p className={styles.stubCopy}>
              {title ? `${name}, ${title}. ` : ''}
              {counters?.blurb ?? 'Abilities are in the banner above. Matchups use live lane win rates.'}
            </p>
            {patchNote ? (
              <p className={styles.stubCopy}>
                This patch: {patchNote.kind.toLowerCase()} · {patchNote.lines.map((line) => line.t).join(' ')}
              </p>
            ) : (
              <p className={styles.stubCopy}>No numbered change for {name} in the latest patch notes.</p>
            )}
            <button type="button" className={styles.primary} onClick={() => setTab('Matchups')}>
              Open matchups
            </button>
          </div>
        ) : tab === 'Builds' || tab === 'Skill order' || tab === 'Pro play' ? (
          <div className={styles.stubPanel}>
            <h2 className={styles.stubTitle}>{tab} needs a data source</h2>
            <p className={styles.stubCopy}>
              We will not invent builds or skill orders. Matchups below use live lane win rates.
            </p>
            <button type="button" className={styles.primary} onClick={() => setTab('Matchups')}>
              Open matchups
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            <div>
              <div className={styles.controls}>
                <div className={styles.lanes}>
                  {LANES.map((lane) => {
                    const active = (counters?.lane ?? 'TOP').toLowerCase().includes(lane.toLowerCase());
                    return (
                      <span key={lane} className={active ? styles.laneActive : styles.lane}>
                        {lane}
                      </span>
                    );
                  })}
                </div>
                <div className={styles.dir}>
                  <button
                    type="button"
                    className={dir === 'beaten' ? styles.dirActive : styles.dirBtn}
                    onClick={() => setDir('beaten')}
                  >
                    Beats {name}
                  </button>
                  <button
                    type="button"
                    className={dir === 'beats' ? styles.dirActive : styles.dirBtn}
                    onClick={() => setDir('beats')}
                  >
                    {name} beats
                  </button>
                </div>
              </div>

              <div className={styles.table}>
                <div className={styles.tableHead}>
                  <span>#</span>
                  <span>CHAMPION</span>
                  <span>MATCHUP SCORE</span>
                  <span>WIN RATE</span>
                  <span>GAMES</span>
                </div>
                {rows.map((row, i) => {
                  const cover = portraitFor(row.slug, row.imageUrl, row.thumbnailUrl);
                  return (
                    <Link key={row.slug} href={`/champions/${row.slug}`} className={styles.row}>
                      <span className={i < 3 ? styles.rankTop : styles.rank}>{i + 1}</span>
                      <span className={styles.champCell}>
                        <span className={styles.rowAvatar}>
                          {cover ? (
                            <Image src={cover} alt="" width={32} height={32} />
                          ) : (
                            initials(row.name)
                          )}
                        </span>
                        {row.name}
                      </span>
                      <span className={styles.scoreCell}>
                        <span className={styles.scoreNum}>{row.score}</span>
                        <span className={styles.scoreTrack}>
                          <span className={styles.scoreFill} style={{ width: `${row.score}%` }} />
                        </span>
                      </span>
                      <span>{row.winRate}</span>
                      <span className={styles.games}>{counters?.games ?? '—'}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <aside className={styles.rail}>
              {counters?.notes.length ? (
                <div className={styles.railCard}>
                  <div className={styles.railLabel}>HOW {name.toUpperCase()} LOSES</div>
                  <ul>
                    {counters.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Link href={`/counters/${slug}`} className={styles.ctaCard}>
                <div className={styles.ctaTitle}>Counter {name}</div>
                <p className={styles.ctaCopy}>
                  Jump to the three picks we recommend into this lane.
                </p>
              </Link>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
