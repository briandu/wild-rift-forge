import Image from 'next/image';
import Link from 'next/link';
import type { ApiChampion } from '@/lib/api';
import { HERO_FALLBACK, initials } from '@/lib/champions';
import { ChampionSearch } from './ChampionSearch';
import styles from './HomeHero.module.css';

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
    <section className={styles.hero}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.artPlane}>
        <Image
          src={heroImage || HERO_FALLBACK}
          alt=""
          fill
          priority
          className={`${styles.art} animate-hero-art`}
          sizes="(max-width: 900px) 100vw, 64vw"
        />
        <div className={styles.artFade} aria-hidden />
      </div>

      <div className={`${styles.copy} animate-fade-up`}>
        <p className={styles.eyebrow}>RIFTLINE</p>
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
                {c.imageUrl ? (
                  <Image src={c.imageUrl} alt="" width={28} height={28} />
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
  );
}
