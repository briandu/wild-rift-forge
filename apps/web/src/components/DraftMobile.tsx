'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiChampion, TierPlacementDto } from '@/lib/api';
import { type DraftState } from '@/lib/draft-state';
import {
  traitCoverage,
  type CompNeed,
  type DraftSuggestion,
  type TierLane,
} from '@wild-rift-forge/game-data';
import { ChampFace } from './ChampFace';
import styles from './DraftMobile.module.css';

const LANE_SHORT: Record<TierLane, string> = {
  Top: 'TOP',
  Jungle: 'JGL',
  Mid: 'MID',
  Dragon: 'DRG',
  Support: 'SUP',
};

const PEEK = 230;
const MID = 370;
const FULL_CAP = 640;

type PickTarget = { side: 'ally' | 'enemy' | 'allyBans' | 'enemyBans'; index: number };

function scoreTone(score: number) {
  if (score >= 74) return 'high' as const;
  if (score >= 66) return 'mid' as const;
  return 'low' as const;
}

function shortTag(tag: DraftSuggestion['tag']) {
  if (tag === 'BEST FIT') return 'BEST';
  if (tag === 'STRONG') return 'SOLID';
  return 'OK';
}

function snapsFor(maxFull: number) {
  const full = Math.max(MID + 24, Math.min(FULL_CAP, maxFull));
  return [PEEK, Math.min(MID, full - 48), full];
}

function useSheetSnaps() {
  const [maxFull, setMaxFull] = useState(FULL_CAP);

  useEffect(() => {
    function measure() {
      const styles = getComputedStyle(document.documentElement);
      const header = Number.parseInt(styles.getPropertyValue('--shell-height')) || 62;
      const navHeight = Number.parseInt(styles.getPropertyValue('--mobile-nav-height')) || 84;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      setMaxFull(Math.max(PEEK + 80, Math.floor(vh - header - navHeight - 12)));
    }
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  return useMemo(() => snapsFor(maxFull), [maxFull]);
}

export function DraftMobile({
  champions,
  portraits,
  placements,
  state,
  picking,
  locked,
  suggestions,
  needs,
  enemyNames,
  pickingLane,
  onAllyTile,
  onAllyLane,
  onEnemyTile,
  onBan,
  onLock,
  onUndo,
  onReset,
}: {
  champions: ApiChampion[];
  portraits: Record<string, string>;
  placements: TierPlacementDto[];
  state: DraftState;
  picking: PickTarget | null;
  locked: DraftSuggestion | null;
  suggestions: DraftSuggestion[];
  needs: CompNeed[];
  enemyNames: string[];
  pickingLane: TierLane;
  onAllyTile: (index: number) => void;
  onAllyLane: (index: number) => void;
  onEnemyTile: (index: number) => void;
  onBan: (side: 'allyBans' | 'enemyBans', index: number) => void;
  onLock: (slug: string) => void;
  onUndo: () => void;
  onReset: () => void;
}) {
  const snaps = useSheetSnaps();
  const [snap, setSnap] = useState(0);
  const [dragH, setDragH] = useState<number | null>(null);
  const startY = useRef(0);
  const startH = useRef(snaps[0] ?? PEEK);
  const dy = useRef(0);

  const height = dragH ?? snaps[snap] ?? MID;
  const peek = height < 300;
  const full = height >= snaps[2]! - 24;
  const top = suggestions[0] ?? null;

  const enemyRoles = state.enemies.map((slot) => {
    const champ = champions.find((row) => row.slug === slot.slug);
    return champ?.roles ?? [];
  });
  const coverage = traitCoverage(enemyRoles);
  const damageTotal = coverage.physical + coverage.magic;
  const physicalPct = damageTotal > 0 ? Math.round((coverage.physical / damageTotal) * 100) : null;

  const laneEnemy = state.enemies[state.mySlotIndex];
  const laneEnemyName = laneEnemy?.slug
    ? (champions.find((row) => row.slug === laneEnemy.slug)?.name ?? laneEnemy.slug)
    : null;

  const threatText = locked
    ? `${locked.name} is locked for ${pickingLane}. ${
        enemyNames.length
          ? `${enemyNames.join(' / ')} are on their side.`
          : 'Fill their side to tilt the read.'
      }`
    : enemyNames.length
      ? `${enemyNames.join(' / ')} are locked. Suggestions use their ${pickingLane} win rates.`
      : 'Lock enemy champs to tilt suggestions toward that lane.';

  const heading = locked
    ? `${locked.name} locked in`
    : `${Math.max(suggestions.length, 0)} pick${suggestions.length === 1 ? '' : 's'} for ${pickingLane.toLowerCase()}`;

  const sheetSub = peek
    ? 'Drag up for the list'
    : full
      ? top
        ? `Why ${top.name}`
        : 'Full read'
      : 'Drag up for the reasoning';

  const wrFor = (slug: string) => {
    const row = placements.find((item) => item.slug === slug && item.lane === pickingLane);
    return row ? `${row.winRate.toFixed(1)}%` : '';
  };

  const onSheetDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      startY.current = event.clientY;
      startH.current = height;
      dy.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragH(height);
    },
    [height],
  );

  const onSheetMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragH == null) return;
      dy.current = startY.current - event.clientY;
      const next = Math.max(snaps[0]!, Math.min(snaps[2]!, startH.current + dy.current));
      setDragH(next);
    },
    [dragH, snaps],
  );

  const onSheetUp = useCallback(() => {
    if (Math.abs(dy.current) <= 6) {
      dy.current = 0;
      setDragH(null);
      setSnap((cur) => (cur + 1) % 3);
      return;
    }
    const h = dragH ?? snaps[snap]!;
    let best = 1;
    let bestDist = Infinity;
    snaps.forEach((value, index) => {
      const dist = Math.abs(value - h);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    dy.current = 0;
    setSnap(best);
    setDragH(null);
  }, [dragH, snap, snaps]);

  function face(slug: string | null, name?: string, size = 72) {
    if (slug) {
      return (
        <ChampFace
          name={name ?? slug}
          slug={slug}
          size={size}
          round="soft"
          portraits={portraits}
          fill
        />
      );
    }
    return null;
  }

  const emptyBoard =
    state.allies.every((slot) => !slot.slug) &&
    state.enemies.every((slot) => !slot.slug) &&
    state.allyBans.every((slug) => !slug) &&
    state.enemyBans.every((slug) => !slug);

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>CHAMPION SELECT</div>
          <h1 className={styles.title}>Draft</h1>
        </div>
        <div className={styles.headRight}>
          <div className={`${styles.timer} ${locked ? styles.timerLocked : ''}`}>
            <span className={styles.timerDot} />
            <span>{locked ? 'LOCKED' : `Your pick · ${pickingLane}`}</span>
          </div>
          {locked ? (
            <button type="button" className={styles.textBtn} onClick={onUndo}>
              Undo pick
            </button>
          ) : (
            <div className={styles.rankNote}>Tap a slot to fill the lobby</div>
          )}
          {!emptyBoard ? (
            <button type="button" className={styles.textBtn} onClick={onReset}>
              Clear board
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.board} style={{ paddingBottom: height + 16 }}>
        <div className={styles.sideLabelAlly}>YOUR TEAM</div>
        <div className={styles.row}>
          {state.allies.map((slot, index) => {
            const champ = champions.find((row) => row.slug === slot.slug);
            const mine = index === state.mySlotIndex;
            const active = picking?.side === 'ally' && picking.index === index;
            const showSlug = mine && locked ? locked.slug : slot.slug;
            const showName = mine && locked ? locked.name : champ?.name;
            return (
              <div key={slot.lane} className={styles.slot}>
                <button
                  type="button"
                  className={`${styles.tile} ${mine ? styles.tileYou : ''} ${active ? styles.tileActive : ''}`}
                  onClick={() => onAllyTile(index)}
                  aria-label={`${slot.lane}${showName ? `, ${showName}` : ', empty'}`}
                >
                  {showSlug ? (
                    face(showSlug, showName)
                  ) : (
                    <span className={mine ? styles.tileMarkYou : styles.tileMark}>
                      {mine ? '?' : '+'}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`${styles.lane} ${mine ? styles.laneYou : ''}`}
                  onClick={() => onAllyLane(index)}
                  aria-pressed={mine}
                >
                  {LANE_SHORT[slot.lane]}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.sideLabelEnemy}>ENEMY TEAM</div>
        <div className={styles.row}>
          {state.enemies.map((slot, index) => {
            const champ = champions.find((row) => row.slug === slot.slug);
            const threat = index === state.mySlotIndex && Boolean(slot.slug);
            const active = picking?.side === 'enemy' && picking.index === index;
            return (
              <div key={slot.lane} className={styles.slot}>
                <button
                  type="button"
                  className={`${styles.tile} ${threat ? styles.tileThreat : ''} ${active ? styles.tileActive : ''}`}
                  onClick={() => onEnemyTile(index)}
                  aria-label={`${slot.lane}${champ ? `, ${champ.name}` : ', empty'}`}
                >
                  {slot.slug ? (
                    face(slot.slug, champ?.name)
                  ) : (
                    <span className={styles.tileMark}>+</span>
                  )}
                </button>
                <span className={`${styles.lane} ${threat ? styles.laneThreat : ''}`}>
                  {LANE_SHORT[slot.lane]}
                </span>
              </div>
            );
          })}
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>YOUR COMP NEEDS</div>
          {needs.map((need) => (
            <div key={need.trait} className={styles.need}>
              <div className={styles.needRow}>
                <span>{need.label}</span>
                <span style={{ color: need.color }}>{need.status}</span>
              </div>
              <div className={styles.needTrack}>
                <div className={styles.needFill} style={{ width: need.width, background: need.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className={`${styles.card} ${styles.cardTight}`}>
          <div className={styles.cardLabel}>THREAT READ</div>
          <p className={styles.threat}>{threatText}</p>
          {physicalPct != null ? (
            <div className={styles.threatStat}>
              <div className={styles.threatPct}>{physicalPct}%</div>
              <div className={styles.threatMeta}>
                of their damage
                <br />
                is physical
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.bansBlock}>
          <div className={styles.bansHead}>
            <span className={styles.bansKicker}>BANS</span>
            <span className={styles.bansMeta}>{state.allyBans.length} each</span>
          </div>
          {(
            [
              ['YOURS', 'allyBans', '#7BC4E0'],
              ['THEIRS', 'enemyBans', '#E58B7B'],
            ] as const
          ).map(([label, side, color]) => (
            <div key={side} className={styles.banRow}>
              <span className={styles.banSide} style={{ color }}>
                {label}
              </span>
              <div className={styles.banTiles}>
                {state[side].map((slug, index) => {
                  const champ = champions.find((row) => row.slug === slug);
                  const active = picking?.side === side && picking.index === index;
                  return (
                    <button
                      key={index}
                      type="button"
                      className={`${styles.banTile} ${slug ? styles.banFilled : ''} ${active ? styles.tileActive : ''}`}
                      onClick={() => onBan(side, index)}
                      title={champ?.name ?? 'Empty ban'}
                    >
                      {slug ? face(slug, champ?.name, 40) : <span className={styles.tileMark}>—</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className={styles.sheet}
        style={{
          height,
          transition: dragH == null ? 'height .28s cubic-bezier(.4,0,.2,1)' : 'none',
        }}
      >
        <div
          className={styles.handle}
          role="button"
          tabIndex={0}
          aria-label="Resize suggestion sheet"
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setSnap((cur) => (cur + 1) % 3);
            }
          }}
          onPointerDown={onSheetDown}
          onPointerMove={onSheetMove}
          onPointerUp={onSheetUp}
          onPointerCancel={() => {
            dy.current = 0;
            setDragH(null);
          }}
        >
          <div className={styles.grip} />
          <div className={styles.sheetHead}>
            <div className={styles.sheetCopy}>
              <div className={styles.sheetTitle}>{heading}</div>
              <div className={styles.sheetSub}>
                {peek ? sheetSub : laneEnemyName ? `vs ${laneEnemyName}` : sheetSub}
              </div>
            </div>
          </div>
        </div>
        {peek && suggestions.length > 0 ? (
          <div className={styles.peekRow}>
            {suggestions.slice(0, 3).map((pick) => {
              const tone = scoreTone(pick.score);
              return (
                <button
                  key={pick.slug}
                  type="button"
                  className={`${styles.peek} ${
                    tone === 'high' ? styles.peek_high : tone === 'mid' ? styles.peek_mid : styles.peek_low
                  }`}
                  onClick={() => onLock(pick.slug)}
                >
                  <span className={styles.peekFace}>{face(pick.slug, pick.name, 32)}</span>
                  <span
                    className={`${styles.peekScore} ${
                      tone === 'high' ? styles.score_high : tone === 'mid' ? styles.score_mid : styles.score_low
                    }`}
                  >
                    {pick.score}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className={styles.sheetBody}>
          <div className={styles.suggestList}>
            {suggestions.map((pick) => {
              const tone = scoreTone(pick.score);
              const isLocked = locked?.slug === pick.slug;
              return (
                <button
                  key={pick.slug}
                  type="button"
                  className={`${styles.suggest} ${isLocked ? styles.suggestLocked : ''}`}
                  onClick={() => onLock(pick.slug)}
                >
                  <span className={styles.suggestFace}>{face(pick.slug, pick.name, 50)}</span>
                  <span className={styles.suggestBody}>
                    <span className={styles.suggestHead}>
                      <span className={styles.suggestName}>{pick.name}</span>
                      <span className={`${styles.tag} ${pick.tag === 'BEST FIT' ? styles.tagBest : ''}`}>
                        {isLocked ? 'LOCKED' : shortTag(pick.tag)}
                      </span>
                    </span>
                    <span className={styles.suggestWhy}>{pick.why}</span>
                  </span>
                  <span className={styles.suggestFit}>
                    <span
                      className={`${styles.suggestScore} ${
                        tone === 'high' ? styles.score_high : tone === 'mid' ? styles.score_mid : styles.score_low
                      }`}
                    >
                      {pick.score}
                    </span>
                    <span className={styles.suggestWr}>{wrFor(pick.slug)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {full && top ? (
            <div className={styles.whyBlock}>
              <div className={styles.cardLabel}>WHY {top.name.toUpperCase()}</div>
              {(top.reasons.length ? top.reasons : [top.why]).map((reason, index) => (
                <div key={reason} className={styles.whyRow}>
                  <span className={styles.whyN}>{index + 1}</span>
                  <span className={styles.whyT}>{reason}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.sheetCta}>
          {locked ? (
            <Link href={`/counters/${locked.slug}`} className={styles.lockBtn}>
              See counters for {locked.name}
            </Link>
          ) : top ? (
            <button type="button" className={styles.lockBtn} onClick={() => onLock(top.slug)}>
              Lock in {top.name}
            </button>
          ) : (
            <div className={styles.lockDisabled}>Fill a lane to see picks</div>
          )}
        </div>
      </div>
    </div>
  );
}
