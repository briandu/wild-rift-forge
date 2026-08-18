'use client';

import Link from 'next/link';
import type { TierLane } from '@wild-rift-forge/game-data';
import type { ApiChampion } from '@/lib/api';
import { DRAFT_LANES } from '@/lib/draft-state';
import { DRAFT_MODES, DRAFT_READY_STEPS, type DraftMode } from '@/lib/draft-copy';
import { ChampFace } from './ChampFace';
import { DraftSessionList } from './DraftSessionList';
import styles from './DraftLanding.module.css';

export function DraftReady({
  champions,
  portraits,
  pool,
  mode,
  lane,
  onMode,
  onLane,
  onStart,
  userId = null,
}: {
  champions: ApiChampion[];
  portraits: Record<string, string>;
  pool: string[];
  mode: DraftMode;
  lane: TierLane;
  onMode: (mode: DraftMode) => void;
  onLane: (lane: TierLane) => void;
  onStart: () => void;
  userId?: string | null;
}) {
  const faces = pool.slice(0, 6).map((slug) => {
    const champ = champions.find((row) => row.slug === slug);
    return { slug, name: champ?.name ?? slug };
  });

  return (
    <div className={styles.pad}>
      <div className={styles.inner}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.hero}>
          <div className={styles.kicker}>DRAFT ASSISTANT</div>
          <h1 className={styles.title}>Ready when the lobby is</h1>
          <p className={styles.copy}>
            Set your lane, then lock enemy picks as they come in. Suggestions update on every pick,
            and the board turns into a matchup brief the moment you commit.
          </p>
        </div>

        <div className={styles.setup}>
          <div className={styles.cols}>
            <div className={styles.col}>
              <div className={styles.label}>QUEUE</div>
              <div className={styles.modes} role="tablist" aria-label="Queue">
                {DRAFT_MODES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={mode === name ? styles.modeOn : styles.mode}
                    onClick={() => onMode(name)}
                    role="tab"
                    aria-selected={mode === name}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className={styles.label} style={{ marginTop: 26 }}>
                YOUR LANE
              </div>
              <div className={styles.lanes} role="group" aria-label="Your lane">
                {DRAFT_LANES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={lane === name ? styles.laneOn : styles.lane}
                    onClick={() => onLane(name)}
                    aria-pressed={lane === name}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.col}>
              <div className={styles.poolHead}>
                <div className={styles.label}>WEIGHTED ON YOUR POOL</div>
                <div className={styles.poolCount}>
                  {pool.length} {pool.length === 1 ? 'champion' : 'champions'}
                </div>
              </div>
              {pool.length === 0 ? (
                <div className={styles.poolEmpty}>
                  <p>No champion pool yet. Suggestions will fall back to lane win rates until you add one.</p>
                  <Link href="/me?tab=pool" className={styles.poolLink}>
                    Set your pool
                  </Link>
                </div>
              ) : (
                <div className={styles.faces}>
                  {faces.map((face) => (
                    <Link key={face.slug} href={`/counters/${face.slug}`} className={styles.face}>
                      <ChampFace name={face.name} slug={face.slug} size={54} round="soft" portraits={portraits} />
                      <div className={styles.faceName}>{face.name}</div>
                    </Link>
                  ))}
                </div>
              )}
              <button type="button" className={`${styles.cta} ${styles.start}`} onClick={onStart}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden>
                  <path d="M7 5l11 7-11 7z" />
                </svg>
                Start the draft
              </button>
              <div className={styles.startFine}>Nothing is locked until you tap a slot.</div>
            </div>
          </div>
        </div>

        <div className={styles.steps}>
          {DRAFT_READY_STEPS.map((step) => (
            <div key={step.n} className={styles.step}>
              <div className={styles.stepN}>{step.n}</div>
              <div className={styles.stepK}>{step.k}</div>
              <div className={styles.stepV}>{step.v}</div>
            </div>
          ))}
        </div>

        <DraftSessionList userId={userId} champions={champions} portraits={portraits} />
      </div>
    </div>
  );
}
