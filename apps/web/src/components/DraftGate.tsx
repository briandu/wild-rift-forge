'use client';

import Link from 'next/link';
import type { ApiChampion } from '@/lib/api';
import { DRAFT_GATE_FREE, DRAFT_GATE_GETS, DRAFT_TEASE_SLUGS } from '@/lib/draft-copy';
import { ChampFace } from './ChampFace';
import styles from './DraftLanding.module.css';

const TEASE_TAGS = ['BEST FIT', 'STRONG', 'PLAYABLE'] as const;

export function DraftGate({
  champions,
  portraits,
}: {
  champions: ApiChampion[];
  portraits: Record<string, string>;
}) {
  const tease = DRAFT_TEASE_SLUGS.map((slug, index) => {
    const champ = champions.find((row) => row.slug === slug);
    return {
      slug,
      name: champ?.name ?? slug,
      tag: TEASE_TAGS[index] ?? 'PLAYABLE',
    };
  });

  return (
    <div className={styles.pad}>
      <div className={styles.inner}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.hero}>
          <div className={styles.lock} aria-hidden>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
              <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
              <path d="M8 10.5V7.2a4 4 0 018 0v3.3" />
            </svg>
          </div>
          <div className={styles.kicker}>FORGE PRO</div>
          <h1 className={styles.title}>The draft assistant is part of Pro</h1>
          <p className={styles.copy}>
            Live pick scoring runs on your match history and the enemy&apos;s committed picks, which
            is the part we cannot serve for free. Everything else on Forge stays open.
          </p>
          <div className={styles.actions}>
            <Link href="/upgrade" className={styles.cta}>
              See plans
            </Link>
            <Link href="/me?tab=pool" className={styles.ghost}>
              Set up my pool first
            </Link>
          </div>
          <p className={styles.fine}>£4 a month on annual billing. Nothing charged during beta.</p>
        </div>

        <div className={styles.tease} aria-hidden>
          <div className={styles.teaseBar}>
            <div className={styles.teaseTimer}>
              <span className={styles.teaseDot} />
              Your pick
            </div>
            <div className={styles.teaseMeta}>Preview</div>
          </div>
          <div className={styles.teaseBody}>
            <div className={styles.blur}>
              <div className={styles.teaseH}>Pick these into their comp</div>
              <p className={styles.teaseP}>
                Weighted against locked enemy picks, your team&apos;s damage profile and your lane
                pool.
              </p>
              {tease.map((row) => (
                <div key={row.slug} className={styles.teaseRow}>
                  <div className={styles.teaseFace}>
                    <ChampFace name={row.name} slug={row.slug} size={52} round="soft" portraits={portraits} fill />
                  </div>
                  <div>
                    <div>
                      <span className={styles.teaseName}>{row.name}</span>
                      <span className={styles.teaseTag}>{row.tag}</span>
                    </div>
                    <div className={styles.skel} />
                    <div className={styles.skelShort} />
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.teaseFade} />
          </div>
        </div>

        <div className={styles.gets}>
          {DRAFT_GATE_GETS.map((item) => (
            <div key={item.k} className={styles.get}>
              <div className={styles.getInner}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8FEDB8" strokeWidth="3" aria-hidden>
                  <path d="M4 12.5l5.2 5.2L20 7" />
                </svg>
                <div>
                  <div className={styles.getK}>{item.k}</div>
                  <div className={styles.getV}>{item.v}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.freeRow}>
          <div className={styles.freeK}>Free on every account, no draft needed:</div>
          <div className={styles.freeChips}>
            {DRAFT_GATE_FREE.map((item) => (
              <Link key={item.k} href={item.href} className={styles.freeChip}>
                {item.k}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
