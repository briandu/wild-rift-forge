'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { initials } from '@/lib/champions';
import styles from './DraftBoard.module.css';

const ALLIES: Array<{
  lane: string;
  name?: string;
  slug?: string;
  picking?: boolean;
}> = [
  { name: 'Ashe', lane: 'Dragon', slug: 'ashe' },
  { name: 'Leona', lane: 'Support', slug: 'leona' },
  { name: 'Ahri', lane: 'Mid', slug: 'ahri' },
  { lane: 'Jungle' },
  { lane: 'Top', picking: true },
];

const ENEMIES = [
  { name: 'Sett', lane: 'Top', slug: 'sett' },
  { name: 'Rammus', lane: 'Jungle', slug: 'rammus' },
  { name: 'Yasuo', lane: 'Mid', slug: 'yasuo' },
  { name: 'Jinx', lane: 'Dragon', slug: 'jinx' },
  { name: 'Braum', lane: 'Support', slug: 'braum' },
];

const SUGGESTIONS = [
  {
    slug: 'volibear',
    name: 'Volibear',
    score: 92,
    tag: 'BEST FIT',
    why: 'Beats Sett in lane and gives your comp the frontline it is missing.',
    reasons: ['Counters Sett', 'Adds frontline', 'In your pool'],
  },
  {
    slug: 'renekton',
    name: 'Renekton',
    score: 84,
    tag: 'STRONG',
    why: 'Wins the Sett lane outright, but leaves the comp light on tankiness.',
    reasons: ['Wins lane', 'Low frontline'],
  },
  {
    slug: 'gwen',
    name: 'Gwen',
    score: 79,
    tag: 'STRONG',
    why: 'Blanks his ultimate and scales into their backline later.',
    reasons: ['Blanks ult', 'Scales'],
  },
];

const NEEDS = [
  { k: 'Frontline', v: 'Missing', w: '22%', c: 'var(--danger)' },
  { k: 'Engage', v: 'Thin', w: '45%', c: 'var(--warn)' },
  { k: 'Magic damage', v: 'Covered', w: '78%', c: 'var(--success)' },
];

const BANS = ['D', 'M', 'K', 'T', 'L'];

export function DraftBoard({ portraits = {} }: { portraits?: Record<string, string> }) {
  const [lockedSlug, setLockedSlug] = useState<string | null>(null);
  const locked = SUGGESTIONS.find((s) => s.slug === lockedSlug) ?? null;

  return (
    <div className={styles.board}>
      <aside className={styles.col}>
        <div className={styles.sideLabelAlly}>YOUR TEAM</div>
        {ALLIES.map((slot) => {
          const isPickSlot = !!slot.picking;
          const showName = isPickSlot && locked ? locked.name : slot.name;
          const showArt =
            isPickSlot && locked
              ? portraits[locked.slug]
              : slot.slug
                ? portraits[slot.slug]
                : undefined;
          const active = isPickSlot;
          return (
            <div key={slot.lane} className={`${styles.slot} ${active ? styles.slotActive : ''}`}>
              <div className={styles.slotAvatar}>
                {showArt ? (
                  <Image src={showArt} alt="" width={38} height={38} />
                ) : showName ? (
                  initials(showName)
                ) : isPickSlot ? (
                  '…'
                ) : (
                  '—'
                )}
              </div>
              <div>
                <div className={styles.slotName}>
                  {isPickSlot && !locked ? 'Picking…' : showName ?? '—'}
                </div>
                <div className={styles.slotLane}>{slot.lane}</div>
              </div>
            </div>
          );
        })}
      </aside>

      <section className={styles.center}>
        <div className={styles.centerTop}>
          <div className={`${styles.timer} ${locked ? styles.timerLocked : ''}`}>
            <span className={styles.timerDot} />
            {locked ? `${locked.name} locked` : 'Your pick · 0:24'}
          </div>
          <div className={styles.rank}>Ranked · Emerald II</div>
          <div className={styles.spacer} />
          {locked ? (
            <button type="button" className={styles.undo} onClick={() => setLockedSlug(null)}>
              Undo pick
            </button>
          ) : null}
        </div>

        <h1 className={styles.heading}>
          {locked ? `${locked.name} is a good call` : 'Pick these into their comp'}
        </h1>
        <p className={styles.sub}>
          Weighted against Sett top, their physical threat, and champions in your pool.
        </p>

        <div className={styles.suggestions}>
          {SUGGESTIONS.map((c, i) => {
            const isLocked = lockedSlug === c.slug;
            const art = portraits[c.slug];
            return (
              <div
                key={c.slug}
                className={`${styles.suggestion} ${i === 0 && !lockedSlug ? styles.suggestionTop : ''} ${isLocked ? styles.suggestionLocked : ''}`}
              >
                <Link href={`/counters/${c.slug}`} className={styles.suggestionArt}>
                  {art ? (
                    <Image src={art} alt="" width={56} height={56} />
                  ) : (
                    initials(c.name)
                  )}
                </Link>
                <div className={styles.suggestionBody}>
                  <div className={styles.suggestionHead}>
                    <span className={styles.suggestionName}>{c.name}</span>
                    <span className={styles.tag}>{isLocked ? 'LOCKED IN' : c.tag}</span>
                  </div>
                  <p className={styles.why}>{c.why}</p>
                  <div className={styles.reasons}>
                    {c.reasons.map((r) => (
                      <span key={r}>{r}</span>
                    ))}
                  </div>
                </div>
                <div className={styles.fit}>
                  <div className={styles.fitScore}>{c.score}</div>
                  <div className={styles.fitLabel}>DRAFT FIT</div>
                </div>
                {isLocked ? (
                  <Link href={`/counters/${c.slug}`} className={styles.btnSecondary}>
                    View counters
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => setLockedSlug(c.slug)}
                  >
                    Lock in
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>YOUR COMP NEEDS</div>
            {NEEDS.map((n) => (
              <div key={n.k} className={styles.need}>
                <div className={styles.needRow}>
                  <span>{n.k}</span>
                  <span style={{ color: n.c }}>{n.v}</span>
                </div>
                <div className={styles.needTrack}>
                  <div className={styles.needFill} style={{ width: n.w, background: n.c }} />
                </div>
              </div>
            ))}
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>THREAT READ</div>
            <p className={styles.threat}>
              Sett and Jinx make the draft skew physical. Prioritise armour and a real front line
              before chasing more damage.
            </p>
            <div className={styles.threatStat}>
              <div className={styles.threatPct}>62%</div>
              <div className={styles.threatMeta}>
                of their damage
                <br />
                is physical
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className={styles.col}>
        <div className={styles.sideLabelEnemy}>ENEMY TEAM</div>
        {ENEMIES.map((slot) => {
          const art = portraits[slot.slug];
          return (
            <Link key={slot.slug} href={`/counters/${slot.slug}`} className={styles.slot}>
              <div className={styles.slotAvatar}>
                {art ? <Image src={art} alt="" width={38} height={38} /> : initials(slot.name)}
              </div>
              <div>
                <div className={styles.slotName}>{slot.name}</div>
                <div className={styles.slotLane}>{slot.lane}</div>
              </div>
            </Link>
          );
        })}
        <div className={styles.bansLabel}>BANS</div>
        <div className={styles.bans}>
          {BANS.map((b) => (
            <div key={b} className={styles.ban}>
              {b}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
