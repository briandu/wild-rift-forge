'use client';

import Image from 'next/image';
import Link from 'next/link';
import { TIER_LANES } from '@wild-rift-forge/game-data';
import type { CountersResponse } from '@/lib/api-types';
import { resolveAbilities } from '@/lib/abilities';
import { bannerFocusFor } from '@/lib/banner-focus';
import { artFor, HERO_FALLBACK, initials, portraitFor } from '@/lib/champions';
import { laneFromLabel } from '@/lib/placements';
import { AbilityStrip } from './AbilityStrip';
import { LaneGlyph } from './LaneGlyph';
import styles from './CounterResults.module.css';

export function CounterResults({ data }: { data: CountersResponse }) {
  const enemy = data.enemy;
  const art = enemy.imageUrl || HERO_FALLBACK;
  const focus = bannerFocusFor(enemy.slug);
  const abilities = resolveAbilities(data.abilities);
  const activeLane = laneFromLabel(data.lane);
  const sample = data.sample ?? 0;
  const target = data.target ?? 2000;

  return (
    <div>
      <section className={styles.hero}>
        <Image
          src={art}
          alt=""
          fill
          priority
          quality={90}
          className={`${styles.heroArt} animate-hero-art`}
          style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
          sizes="100vw"
        />
        <div className={styles.heroFade} aria-hidden />

        <div className={`${styles.heroContent} animate-fade-up`}>
          <Link href="/" className={styles.back}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M14 6l-6 6 6 6" />
            </svg>
            New search
          </Link>

          <p className={styles.eyebrow}>ENEMY PICK · {data.lane}</p>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{enemy.name.toUpperCase()}</h1>
            <Link href={`/champions/${enemy.slug}`} className={styles.profileLink}>
              Full profile
            </Link>
          </div>
          <p className={styles.blurb}>{data.blurb}</p>

          <div className={styles.stats}>
            {data.stats.map((s) => (
              <div key={s.label} className={styles.stat}>
                <div className={styles.statValue}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.heroFooter}>
          <AbilityStrip abilities={abilities} overlay />
          <div className={`${styles.lanes} xfade`} role="group" aria-label="Lanes">
            {TIER_LANES.map((lane) => {
              const active = activeLane === lane;
              return (
                <Link
                  key={lane}
                  href={`/counters/${enemy.slug}?lane=${lane}`}
                  scroll={false}
                  className={active ? styles.laneActive : styles.lane}
                  aria-current={active ? 'page' : undefined}
                >
                  <LaneGlyph lane={lane} />
                  {lane}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`${styles.body} animate-fade-up-delay`}>
        {data.picks[0] ? (
          <Link
            href={`/matchups?you=${data.picks[0].slug}&them=${enemy.slug}&lane=${activeLane ?? 'Top'}`}
            className={styles.muCta}
          >
            <span>
              <span className={styles.muCtaTitle}>Already picked? Play the matchup</span>
              <span className={styles.muCtaSub}>
                Game plan, trades and build for {data.picks[0].name} into {enemy.name}.
              </span>
            </span>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7FDCFF"
              strokeWidth="2.4"
              aria-hidden
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        ) : null}

        {data.thin ? (
          <div className={styles.thin}>
            <span className={styles.thinBadge}>LOW CONFIDENCE</span>
            <div className={styles.thinTitle}>
              Only {data.sample ?? data.games} games with {enemy.name} this patch
            </div>
            <p className={styles.thinBody}>
              Scores unlock at about {target} games. Treat these picks as directional until the
              sample grows.
            </p>
            <div className={styles.thinBar}>
              <div
                className={styles.thinFill}
                style={{
                  width: `${target > 0 ? Math.min(100, Math.round((sample / target) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Best picks against {enemy.name}</h2>
          <p className={styles.sectionMeta}>Ranked by matchup score · {data.games} games</p>
        </div>

        <div className={styles.picks}>
          {data.picks.map((c) => {
            const strong = c.tag === 'STRONG COUNTER';
            const cover = artFor(c.slug, c.imageUrl);
            const focus = bannerFocusFor(c.slug);
            return (
              <Link key={c.slug} href={`/champions/${c.slug}`} className={styles.pick}>
                <div className={styles.pickArt}>
                  <Image
                    src={cover}
                    alt=""
                    fill
                    quality={90}
                    className={styles.pickCover}
                    style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
                    sizes="320px"
                  />
                  <div className={styles.pickArtFade} />
                  <span
                    className={styles.tag}
                    style={{
                      color: strong ? 'var(--success)' : '#edecf7',
                      borderColor: strong ? 'rgba(123,224,168,.45)' : 'rgba(255,255,255,.28)',
                    }}
                  >
                    {c.tag}
                  </span>
                  <div className={styles.scoreBlock}>
                    <div className={styles.score}>{c.score}</div>
                    <div className={styles.scoreLabel}>MATCHUP</div>
                  </div>
                </div>
                <div className={styles.pickBody}>
                  <h3 className={styles.pickName}>{c.name}</h3>
                  <p className={styles.why}>{c.why}</p>
                  <div className={styles.barRow}>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${c.score}%` }} />
                    </div>
                    <span className={styles.wr}>{c.winRate} WR</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className={styles.lower}>
          <div className={styles.alsoCol}>
            <div className={styles.alsoHead}>ALSO WORKS</div>
            <div className={styles.also}>
              {data.also.map((c) => {
                const cover = portraitFor(c.slug, c.imageUrl, c.thumbnailUrl);
                return (
                  <Link key={c.slug} href={`/champions/${c.slug}`} className={styles.alsoItem}>
                    <span className={styles.alsoAvatar}>
                      {cover ? (
                        <Image src={cover} alt="" width={34} height={34} />
                      ) : (
                        initials(c.name)
                      )}
                    </span>
                    <span className={styles.alsoName}>{c.name}</span>
                    <span className={styles.alsoScore}>{c.score}</span>
                    <span className={styles.alsoWr}>{c.winRate}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {data.notes.length > 0 ? (
            <aside className={styles.notes}>
              <h3 className={styles.notesTitle}>HOW {enemy.name.toUpperCase()} LOSES</h3>
              <ul>
                {data.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </section>
    </div>
  );
}
