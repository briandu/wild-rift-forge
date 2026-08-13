import Link from 'next/link';
import { ChampFace } from '@/components/ChampFace';
import { Shell } from '@/components/Shell';
import { fetchChampions } from '@/lib/api';
import { portraitsFromRoster } from '@/lib/champions';
import styles from './page.module.css';

const POOL = [
  { name: 'Renekton', note: '42 games this season', wr: '58%', color: '#8FEDB8' },
  { name: 'Gwen', note: '31 games this season', wr: '55%', color: '#8FEDB8' },
  { name: 'Malphite', note: '18 games this season', wr: '50%', color: '#BBB7D4' },
  { name: 'Sett', note: '12 games this season', wr: '41%', color: '#E58B7B' },
] as const;

const ROWS = [
  { label: 'Riot ID', value: 'Summoner#NA1' },
  { label: 'Region', value: 'North America' },
  { label: 'Rank shown', value: 'Emerald+' },
  { label: 'Notifications', value: 'Patch days' },
] as const;

export default async function MePage() {
  const portraits = portraitsFromRoster(await fetchChampions());

  return (
    <Shell pathname="/me">
      <section className={styles.page}>
        <div className={styles.identity}>
          <div className={styles.avatar} aria-hidden />
          <div>
            <h1 className={styles.name}>Summoner#NA1</h1>
            <p className={styles.meta}>Emerald II · Top lane · NA</p>
          </div>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statValue} style={{ color: 'var(--success)' }}>
              57%
            </div>
            <div className={styles.statLabel}>WIN RATE</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>148</div>
            <div className={styles.statLabel}>GAMES</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>6</div>
            <div className={styles.statLabel}>POOL SIZE</div>
          </div>
        </div>

        <div className={styles.sectionLabel}>YOUR CHAMPION POOL</div>
        <div className={styles.pool}>
          {POOL.map((c) => (
            <Link key={c.name} href={`/champions/${c.name.toLowerCase()}`} className={styles.poolRow}>
              <ChampFace name={c.name} size={44} portraits={portraits} />
              <div className={styles.poolCopy}>
                <div className={styles.poolName}>{c.name}</div>
                <div className={styles.poolNote}>{c.note}</div>
              </div>
              <div className={styles.poolWr} style={{ color: c.color }}>
                {c.wr}
              </div>
            </Link>
          ))}
        </div>

        <div className={styles.settings}>
          {ROWS.map((row) => (
            <div key={row.label} className={styles.settingsRow}>
              <span>{row.label}</span>
              <span className={styles.settingsValue}>{row.value}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4A4560" strokeWidth="2.4" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          ))}
        </div>

        <Link href="/auth" className={styles.accountLink}>
          Account & sign in
        </Link>
      </section>
    </Shell>
  );
}
