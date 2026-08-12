import Image from 'next/image';
import Link from 'next/link';
import type { CountersResponse } from '@/lib/api';
import { HERO_FALLBACK, initials } from '@/lib/champions';
import styles from './CounterResults.module.css';

const LANES = ['Top', 'Jungle', 'Mid', 'Dragon', 'Support'] as const;

export function CounterResults({ data }: { data: CountersResponse }) {
  const enemy = data.enemy;
  const art = enemy.imageUrl || HERO_FALLBACK;

  return (
    <div>
      <section className={styles.hero}>
        <Image
          src={art}
          alt=""
          fill
          priority
          className={`${styles.heroArt} animate-hero-art`}
          sizes="100vw"
        />
        <div className={styles.heroFade} aria-hidden />

        <div className={`${styles.heroContent} animate-fade-up`}>
          <Link href="/" className={styles.back}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
              <div key={s.label}>
                <div className={styles.statValue}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.lanes} aria-label="Lanes">
          {LANES.map((lane) => {
            const active = data.lane.toLowerCase().includes(lane.toLowerCase());
            return (
              <span key={lane} className={active ? styles.laneActive : styles.lane}>
                {lane}
              </span>
            );
          })}
        </div>
      </section>

      <section className={`${styles.body} animate-fade-up-delay`}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Best picks against {enemy.name}</h2>
          <p className={styles.sectionMeta}>
            Stub matchup scores · {data.games} games
          </p>
        </div>

        <div className={styles.picks}>
          {data.picks.map((c) => {
            const strong = c.tag === 'STRONG COUNTER';
            return (
              <Link key={c.slug} href={`/champions/${c.slug}`} className={styles.pick}>
                <div className={styles.pickArt}>
                  <span className={styles.pickInitial}>{initials(c.name)}</span>
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

        <div className={styles.alsoHead}>Also strong</div>
        <div className={styles.also}>
          {data.also.map((c) => (
            <Link key={c.slug} href={`/champions/${c.slug}`} className={styles.alsoItem}>
              <span className={styles.alsoAvatar}>{initials(c.name)}</span>
              <span className={styles.alsoName}>{c.name}</span>
              <span className={styles.alsoScore}>{c.score}</span>
              <span className={styles.alsoWr}>{c.winRate}</span>
            </Link>
          ))}
        </div>

        {data.notes.length > 0 ? (
          <div className={styles.notes}>
            <h3 className={styles.notesTitle}>How to play the matchup</h3>
            <ul>
              {data.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
