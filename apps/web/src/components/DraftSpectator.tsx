'use client';

import { useEffect, useState } from 'react';
import type { ApiChampion, TierPlacementDto } from '@/lib/api';
import { fetchSharedDraft } from '@/lib/draft-sessions';
import { firstPickKnown, formatClock, guessChampionLanes, isFlexPick, lockedPickCount, phaseChrome } from '@/lib/draft-live';
import { allySlotsInPickOrder, enemySlotsInPickOrder, slotView, type DraftState } from '@/lib/draft-state';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { ChampFace } from './ChampFace';
import { LaneGlyph } from './LaneGlyph';
import styles from './DraftBoard.module.css';

export function DraftSpectator({
  token,
  champions,
  portraits,
  placements,
}: {
  token: string;
  champions: ApiChampion[];
  portraits: Record<string, string>;
  placements: TierPlacementDto[];
}) {
  const [state, setState] = useState<DraftState | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setMissing(true);
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    async function load() {
      const shared = await fetchSharedDraft(supabase, token);
      if (cancelled) return;
      if (!shared) {
        setMissing(true);
        return;
      }
      setState(shared.state);
    }
    void load();
    const tick = window.setInterval(() => void load(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [token]);

  if (missing) {
    return (
      <div className={styles.wrap} style={{ padding: 48, textAlign: 'center' }}>
        <div className={styles.heading}>This draft link is not live</div>
        <p className={styles.sub}>Ask your friend to start the board again and send a new link.</p>
      </div>
    );
  }

  if (!state) return <div className={styles.wrap} />;

  const chrome = phaseChrome(null, lockedPickCount(state));
  const elapsed =
    state.startedAt != null ? Math.max(0, Math.round((Date.now() - state.startedAt) / 1000)) : 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.board}>
        <aside className={styles.col}>
          <div className={styles.sideHead}>
            <div className={styles.sideLabelAlly} style={{ marginBottom: 0 }}>
              YOUR TEAM
            </div>
            {firstPickKnown(state) ? <div className={styles.firstPickTag}>1ST PICK</div> : null}
          </div>
          {allySlotsInPickOrder(state).map((slot, order) => {
            const view = slotView(state, 'ally', slot.boardIndex);
            const champ = champions.find((row) => row.slug === view.slug);
            return (
              <div
                key={slot.lane}
                className={`${styles.slot} ${slot.boardIndex === state.mySlotIndex ? styles.slotMine : ''} ${
                  view.isPre ? styles.slotPre : ''
                }`}
              >
                <div className={styles.slotRow}>
                  <LaneGlyph lane={slot.lane} size={13} />
                  <div className={styles.slotAvatar}>
                    {view.slug ? (
                      <ChampFace
                        name={champ?.name ?? view.slug}
                        slug={view.slug}
                        size={38}
                        round="soft"
                        portraits={portraits}
                        fill
                      />
                    ) : (
                      '—'
                    )}
                  </div>
                  <div>
                    <div className={styles.slotNameRow}>
                      <div className={styles.slotName}>{champ?.name ?? 'Not picked yet'}</div>
                      {slot.boardIndex === state.mySlotIndex ? (
                        <span className={styles.slotMineTag}>YOU</span>
                      ) : null}
                      {firstPickKnown(state) && order === 0 ? (
                        <span className={styles.slotFirst}>1ST</span>
                      ) : null}
                    </div>
                    <div className={styles.slotLane}>{slot.lane} lane</div>
                  </div>
                </div>
              </div>
            );
          })}
        </aside>
        <section className={styles.center}>
          <div className={styles.centerTop}>
            <div
              className={styles.phaseBadge}
              style={{ background: chrome.background, border: `1px solid ${chrome.border}` }}
            >
              <span className={styles.timerDot} style={{ background: chrome.color }} />
              <span className={styles.phaseBadgeK} style={{ color: chrome.color }}>
                {chrome.badge}
              </span>
            </div>
            <div className={styles.clocks}>{formatClock(elapsed)}</div>
            <div className={styles.rank}>Spectator</div>
          </div>
          <h1 className={styles.heading}>Watching this draft</h1>
          <p className={styles.sub}>Read-only. Picks update as your friend locks them in.</p>
        </section>
        <aside className={styles.col}>
          <div className={styles.sideLabelEnemy}>ENEMY TEAM</div>
          {enemySlotsInPickOrder(state).map((slot, order) => {
            const view = slotView(state, 'enemy', slot.boardIndex);
            const champ = champions.find((row) => row.slug === view.slug);
            const guesses = guessChampionLanes(view.slug, placements);
            return (
              <div key={`${slot.lane}-${slot.boardIndex}`} className={styles.slot}>
                <div className={styles.slotRow}>
                  <span className={styles.enemyOrder}>PICK {order + 1}</span>
                  <div className={styles.slotAvatar}>
                    {view.slug ? (
                      <ChampFace
                        name={champ?.name ?? view.slug}
                        slug={view.slug}
                        size={38}
                        round="soft"
                        portraits={portraits}
                        fill
                      />
                    ) : (
                      '—'
                    )}
                  </div>
                  <div>
                    <div className={styles.slotName}>{champ?.name ?? 'Not picked yet'}</div>
                    {guesses[0] ? (
                      <div className={styles.laneGuess}>
                        <LaneGlyph lane={guesses[0].lane} size={10} />
                        {guesses[0].lane} {guesses[0].pct}%
                        {isFlexPick(guesses) ? <span className={styles.flexTag}>FLEX</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
