import Image from 'next/image';
import Link from 'next/link';
import type { ApiChampion } from '@/lib/api-types';
import { metaFor } from '@/lib/design-stubs';
import { HERO_FALLBACK, initials, portraitFor } from '@/lib/champions';
import { ChampionSearch } from './ChampionSearch';
import styles from './HomeHero.module.css';

const TRENDING = [
  { name: 'Volibear', tag: 'RISING', pr: '14.1%', tagc: '#8FEDB8' },
  { name: 'Caitlyn', tag: 'S TIER', pr: '19.8%', tagc: '#8FEDB8' },
  { name: 'Gwen', tag: 'BUFFED', pr: '11.8%', tagc: '#7FDCFF' },
  { name: 'Renekton', tag: 'CONTESTED', pr: '16.2%', tagc: '#F0A87B' },
] as const;

const RECENT = [
  { name: 'Sett', note: 'You lost 3 of 5 into him' },
  { name: 'Renekton', note: 'Most banned in your lane' },
  { name: 'Gwen', note: 'Buffed in 6.2b' },
  { name: 'Ashe', note: 'Picked into you twice today' },
] as const;

export function HomeHero({
  champions,
  popular,
  heroImage,
}: {
  champions: ApiChampion[];
  popular: ApiChampion[];
  heroImage: string;
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
            Tell us who you&apos;re up against. We&apos;ll show you the picks that beat them, and the
            reason they work.
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

        <div className={styles.climbHead}>
          <h2 className={styles.sectionTitle}>Climbing this patch</h2>
          <Link href="/tier" className={styles.tierLink}>
            Tier list
          </Link>
        </div>
        <div className={styles.climbTrack}>
          {TRENDING.map((t) => {
            const meta = metaFor(t.name);
            const art = portraitFor(meta.slug);
            return (
              <Link key={t.name} href={`/counters/${meta.slug}`} className={styles.climbCard}>
                <div className={styles.climbBg} style={{ background: meta.bg }} aria-hidden />
                {art ? (
                  <Image src={art} alt="" fill className={styles.climbArt} sizes="212px" />
                ) : (
                  <span className={styles.climbInitial}>{initials(t.name)}</span>
                )}
                <div className={styles.climbFade} aria-hidden />
                <span className={styles.climbTag} style={{ color: t.tagc }}>
                  {t.tag}
                </span>
                <div className={styles.climbMeta}>
                  <div className={styles.climbName}>{t.name}</div>
                  <div className={styles.climbStats}>
                    <span>{meta.wr} WR</span>
                    <span className={styles.climbPr}>{t.pr} PR</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <h2 className={`${styles.sectionTitle} ${styles.laneTitle}`}>Your lane, this week</h2>
        <div className={styles.laneList}>
          {RECENT.map((r) => {
            const meta = metaFor(r.name);
            const art = portraitFor(meta.slug);
            return (
              <Link key={r.name} href={`/counters/${meta.slug}`} className={styles.laneRow}>
                <span className={styles.laneAvatar} style={{ background: meta.bg }}>
                  {art ? (
                    <Image src={art} alt="" width={46} height={46} />
                  ) : (
                    initials(r.name)
                  )}
                </span>
                <span className={styles.laneCopy}>
                  <span className={styles.laneName}>{r.name}</span>
                  <span className={styles.laneNote}>{r.note}</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A4560" strokeWidth="2.4" aria-hidden>
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
