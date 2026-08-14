import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ApiChampion, PatchChampionChangeDto, TierPlacementDto } from '@/lib/api-types';
import { cardFocusFor } from '@/lib/banner-focus';
import { HERO_FALLBACK, initials, portraitFor, splashFor } from '@/lib/champions';
import { formatRate, patchNoteFor, patchNoteLine, rosterBySlug, tierBadge } from '@/lib/placements';
import { skeletonDelay } from '@/lib/loading';
import { ChampionSearch } from './ChampionSearch';
import styles from './HomeHero.module.css';

const TIER_COLOR: Record<string, string> = {
  S: '#8FEDB8',
  A: '#F0A87B',
  B: '#9FCBE4',
  C: '#8B87A8',
};

export function HomeHero({
  champions,
  popular,
  heroImage,
  children,
}: {
  champions: ApiChampion[];
  popular: ApiChampion[];
  heroImage: string;
  children: ReactNode;
}) {
  return (
    <>
      <section className={`${styles.hero} ${styles.desktop}`}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.artPlane}>
          <Image
            src={heroImage || HERO_FALLBACK}
            alt=""
            fill
            priority
            quality={90}
            className={`${styles.art} animate-hero-art`}
            sizes="(max-width: 900px) 100vw, 64vw"
          />
          <div className={styles.artFade} aria-hidden />
        </div>

        <div className={`${styles.copy} animate-fade-up`}>
          <p className={styles.eyebrow}>WILD RIFT COMPANION</p>
          <h1 className={styles.title}>
            Find the right
            <br />
            counter.
          </h1>
          <p className={`${styles.sub} animate-fade-up-delay`}>
            Tell us who you&apos;re up against. We&apos;ll show you the picks that beat them, and
            the reason they work.
          </p>

          <ChampionSearch champions={champions} variant="hero" />

          <div className={styles.popular}>
            <span className={styles.popularLabel}>Popular</span>
            {popular.map((c) => (
              <Link key={c.slug} href={`/counters/${c.slug}`} className={styles.chip}>
                <span className={styles.chipAvatar}>
                  {portraitFor(c.slug, c.imageUrl, c.thumbnailUrl) ? (
                    <Image
                      src={portraitFor(c.slug, c.imageUrl, c.thumbnailUrl)!}
                      alt=""
                      width={28}
                      height={28}
                    />
                  ) : (
                    <span>{initials(c.name)}</span>
                  )}
                </span>
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.mobile}>
        <div className={styles.mobileTop}>
          <h1 className={styles.mobileTitle}>
            Who are you
            <br />
            up against?
          </h1>
          <ChampionSearch champions={champions} variant="mobile" />
        </div>

        <div className={styles.mobileChips}>
          {popular.map((c) => (
            <Link key={c.slug} href={`/counters/${c.slug}`} className={styles.chip}>
              <span className={styles.chipAvatar}>
                {portraitFor(c.slug, c.imageUrl, c.thumbnailUrl) ? (
                  <Image
                    src={portraitFor(c.slug, c.imageUrl, c.thumbnailUrl)!}
                    alt=""
                    width={30}
                    height={30}
                  />
                ) : (
                  <span>{initials(c.name)}</span>
                )}
              </span>
              <span>{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {children}
    </>
  );
}

export function HomeLive({
  champions,
  climbing,
  laneLeaders,
  patchVersion,
  patchNotes,
}: {
  champions: ApiChampion[];
  climbing: TierPlacementDto[];
  laneLeaders: TierPlacementDto[];
  patchVersion: string | null;
  patchNotes: PatchChampionChangeDto[];
}) {
  const bySlug = rosterBySlug(champions);

  return (
    <section className={styles.live}>
      <div className={styles.climbHead}>
        <h2 className={styles.sectionTitle}>Picked this patch</h2>
        <Link href="/tier" className={styles.tierLink}>
          Tier list
        </Link>
      </div>
      {climbing.length > 0 ? (
        <div className={styles.climbTrack}>
          {climbing.map((row) => {
            const champ = bySlug.get(row.slug);
            const art = splashFor(row.slug, champ?.imageUrl ?? row.imageUrl);
            const focus = cardFocusFor(row.slug);
            return (
              <Link key={row.slug} href={`/counters/${row.slug}`} className={styles.climbCard}>
                <div className={styles.climbBg} aria-hidden />
                {art ? (
                  <Image
                    src={art}
                    alt=""
                    fill
                    className={styles.climbArt}
                    style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
                    sizes="(max-width: 900px) 140vw, 640px"
                    quality={90}
                  />
                ) : (
                  <span className={styles.climbInitial}>{initials(row.name)}</span>
                )}
                <div className={styles.climbFade} aria-hidden />
                <span
                  className={styles.climbTag}
                  style={{ color: TIER_COLOR[row.letter] ?? '#8B87A8' }}
                >
                  {tierBadge(row.letter)}
                </span>
                <div className={styles.climbMeta}>
                  <div className={styles.climbName}>{row.name}</div>
                  <div className={styles.climbStats}>
                    <span>{formatRate(row.winRate)} WR</span>
                    <span className={styles.climbPr}>{formatRate(row.pickRate)} PR</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className={styles.emptyCopy}>
          Ranked snapshot is still landing. Search a champion above.
        </p>
      )}

      <h2 className={`${styles.sectionTitle} ${styles.laneTitle}`}>Most picked by lane</h2>
      {laneLeaders.length > 0 ? (
        <div className={styles.laneList}>
          {laneLeaders.map((row) => {
            const champ = bySlug.get(row.slug);
            const art = portraitFor(
              row.slug,
              champ?.imageUrl ?? row.imageUrl,
              champ?.thumbnailUrl ?? row.thumbnailUrl,
            );
            const note =
              patchNoteLine(patchNoteFor(row.slug, patchNotes), patchVersion) ??
              `${formatRate(row.pickRate)} pick rate in ${row.lane}`;
            return (
              <Link key={row.lane} href={`/counters/${row.slug}`} className={styles.laneRow}>
                <span className={styles.laneAvatar}>
                  {art ? <Image src={art} alt="" width={46} height={46} /> : initials(row.name)}
                </span>
                <span className={styles.laneCopy}>
                  <span className={styles.laneName}>
                    {row.lane} · {row.name}
                  </span>
                  <span className={styles.laneNote}>{note}</span>
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4A4560"
                  strokeWidth="2.4"
                  aria-hidden
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className={styles.emptyCopy}>Lane stats appear here after the next ranked snapshot.</p>
      )}
    </section>
  );
}

export function HomeLiveSkeleton() {
  return (
    <section className={styles.live} aria-busy="true">
      <div className={styles.climbHead}>
        <h2 className={styles.sectionTitle}>Picked this patch</h2>
        <Link href="/tier" className={styles.tierLink}>
          Tier list
        </Link>
      </div>
      <LiveSectionSkeleton />
      <h2 className={`${styles.sectionTitle} ${styles.laneTitle}`}>Most picked by lane</h2>
      <LaneListSkeleton />
    </section>
  );
}

function LiveSectionSkeleton() {
  return (
    <div className={styles.climbTrack} aria-hidden>
      {['a', 'b', 'c', 'd'].map((key, i) => (
        <div key={key} className={styles.climbCard}>
          <div data-skel="1" className={styles.skelClimb} style={{ animationDelay: skeletonDelay(i) }} />
        </div>
      ))}
    </div>
  );
}

function LaneListSkeleton() {
  return (
    <div className={styles.laneList} aria-hidden>
      {['Top', 'Jungle', 'Mid', 'Dragon', 'Support'].map((lane, i) => (
        <div key={lane} className={styles.laneRow}>
          <span data-skel="1" className={styles.skelLaneAvatar} style={{ animationDelay: skeletonDelay(i) }} />
          <span className={styles.laneCopy}>
            <span
              data-skel="2"
              className={`skel-text ${styles.laneName}`}
              style={{ animationDelay: skeletonDelay(i) }}
            >
              {lane} · Volibear
            </span>
            <span
              data-skel="3"
              className={`skel-text ${styles.laneNote}`}
              style={{ animationDelay: skeletonDelay(i) }}
            >
              18.2% pick rate in {lane}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
