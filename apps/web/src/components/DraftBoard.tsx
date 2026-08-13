'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiChampion, IconSignatureDto, TierPlacementDto } from '@/lib/api';
import { initials } from '@/lib/champions';
import {
  bannedSlugs,
  clearDraftState,
  DRAFT_LANES,
  emptyDraftState,
  isDraftEmpty,
  loadDraftState,
  saveDraftState,
  takenSlugs,
  type DraftState,
} from '@/lib/draft-state';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { ChampionPicker } from './ChampionPicker';
import styles from './DraftBoard.module.css';
import { DraftCaptureBar } from './DraftCaptureBar';
import { DraftMobile } from './DraftMobile';
import {
  compNeeds,
  rankDraftSuggestions,
  type DraftPlacement,
  type TierLane,
} from '@wild-rift-forge/game-data';

function toPlacement(
  slug: string,
  lane: TierLane,
  champions: ApiChampion[],
  placements: TierPlacementDto[],
): DraftPlacement | null {
  const champ = champions.find((row) => row.slug === slug);
  const row = placements.find((item) => item.slug === slug && item.lane === lane);
  if (!champ && !row) return null;
  return {
    slug,
    name: row?.name ?? champ?.name ?? slug,
    lane,
    letter: row?.letter ?? 'B',
    score: row?.score ?? 50,
    winRate: row?.winRate ?? 50,
    roles: champ?.roles ?? [],
  };
}

type PickTarget = { side: 'ally' | 'enemy' | 'allyBans' | 'enemyBans'; index: number };

export function DraftBoard({
  champions = [],
  portraits = {},
  placements = [],
  signatures = [],
}: {
  champions?: ApiChampion[];
  portraits?: Record<string, string>;
  placements?: TierPlacementDto[];
  signatures?: IconSignatureDto[];
}) {
  const [state, setState] = useState<DraftState>(emptyDraftState);
  const [picking, setPicking] = useState<PickTarget | null>(null);
  const [lockedSlug, setLockedSlug] = useState<string | null>(null);
  const [pool, setPool] = useState<string[]>([]);

  const { allies, enemies, allyBans, enemyBans, mySlotIndex } = state;

  useEffect(() => {
    const restored = loadDraftState();
    if (restored) setState(restored);
  }, []);

  useEffect(() => {
    saveDraftState(state);
  }, [state]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: rows } = await supabase
        .from('user_champion_pool')
        .select('champion_slug')
        .eq('user_id', data.user.id);
      setPool(((rows ?? []) as Array<{ champion_slug: string }>).map((row) => row.champion_slug));
    });
  }, []);

  const myLane = allies[mySlotIndex]?.lane ?? 'Top';
  const pickingLane: TierLane =
    (picking?.side === 'ally' || picking?.side === 'enemy'
      ? (picking.side === 'ally' ? allies : enemies)[picking.index]?.lane
      : myLane) ?? 'Top';

  const taken = useMemo(() => takenSlugs(state), [state]);
  const banned = useMemo(() => bannedSlugs(state), [state]);
  const pickingSlug =
    picking?.side === 'ally'
      ? allies[picking.index]?.slug
      : picking?.side === 'enemy'
        ? enemies[picking.index]?.slug
        : picking
          ? state[picking.side][picking.index]
          : null;
  const pickerExclude = useMemo(
    () => [...taken].filter((slug) => slug !== pickingSlug),
    [pickingSlug, taken],
  );
  const allyRoles = useMemo(
    () =>
      allies.map((slot) => {
        const champ = champions.find((row) => row.slug === slot.slug);
        return champ?.roles ?? [];
      }),
    [allies, champions],
  );

  const suggestions = useMemo(() => {
    const lane = pickingLane;
    const enemySlot = enemies.find((slot) => slot.lane === lane);
    const enemy = enemySlot?.slug ? toPlacement(enemySlot.slug, lane, champions, placements) : null;
    const candidates = placements
      .filter((row) => row.lane === lane)
      .map((row) => toPlacement(row.slug, lane, champions, placements))
      .filter((row): row is DraftPlacement => Boolean(row));
    const fallback = champions
      .map((champ) => toPlacement(champ.slug, lane, champions, placements))
      .filter((row): row is DraftPlacement => Boolean(row));
    return rankDraftSuggestions(
      candidates.length ? candidates : fallback,
      {
        enemy,
        pool: new Set(pool),
        taken,
        bans: banned,
        // Exclude the slot being drafted so a champion is not asked to fill its own gap.
        allyRoles: allyRoles.filter((_, index) => index !== mySlotIndex),
      },
      3,
    );
  }, [allyRoles, banned, champions, enemies, mySlotIndex, pickingLane, placements, pool, taken]);

  const locked = suggestions.find((row) => row.slug === lockedSlug) ?? null;
  const needs = compNeeds(allyRoles);
  const enemyNames = enemies
    .filter((slot) => slot.slug)
    .map((slot) => champions.find((c) => c.slug === slot.slug)?.name ?? slot.slug ?? '');
  const banNames = [...allyBans, ...enemyBans]
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => champions.find((c) => c.slug === slug)?.name ?? slug);

  const assign = useCallback(
    (slug: string) => {
      if (!picking) return;
      setState((cur) => {
        if (picking.side === 'allyBans' || picking.side === 'enemyBans') {
          return {
            ...cur,
            [picking.side]: cur[picking.side].map((item, i) => (i === picking.index ? slug : item)),
          };
        }
        const key = picking.side === 'ally' ? 'allies' : 'enemies';
        return {
          ...cur,
          [key]: cur[key].map((item, i) => (i === picking.index ? { ...item, slug } : item)),
        };
      });
      setLockedSlug(null);
      setPicking(null);
    },
    [picking],
  );

  function lockIn(slug: string) {
    setLockedSlug(slug);
    const index = picking?.side === 'ally' ? picking.index : mySlotIndex;
    setState((cur) => ({
      ...cur,
      allies: cur.allies.map((item, i) => (i === index ? { ...item, slug } : item)),
    }));
    setPicking(null);
  }

  function reset() {
    setState(emptyDraftState());
    setLockedSlug(null);
    setPicking(null);
    clearDraftState();
  }

  function pickAlly(index: number) {
    setPicking({ side: 'ally', index });
    setState((cur) => (cur.allies[index]?.slug ? cur : { ...cur, mySlotIndex: index }));
  }

  function markLane(index: number) {
    setState((cur) => ({ ...cur, mySlotIndex: index }));
  }

  function slotFace(slug: string | null, name?: string) {
    const art = slug ? portraits[slug] : undefined;
    if (art) return <Image src={art} alt="" width={38} height={38} />;
    if (name) return initials(name);
    return '—';
  }

  function banTray(side: 'allyBans' | 'enemyBans') {
    return (
      <div className={styles.bans}>
        {state[side].map((slug, index) => {
          const art = slug ? portraits[slug] : undefined;
          const champ = champions.find((row) => row.slug === slug);
          return (
            <button
              key={index}
              type="button"
              className={`${styles.ban} ${slug ? styles.banFilled : ''}`}
              onClick={() => setPicking({ side, index })}
              title={champ?.name ?? 'Empty ban'}
            >
              {art ? (
                <Image src={art} alt="" width={32} height={32} />
              ) : slug ? (
                (champ?.name.slice(0, 1) ?? '?')
              ) : (
                '—'
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <DraftCaptureBar
        signatures={signatures}
        champions={champions}
        portraits={portraits}
        state={state}
        onRead={(next) => {
          setState(next);
          setLockedSlug(null);
        }}
      />
      <div className={styles.board}>
        <aside className={styles.col}>
          <div className={styles.sideLabelAlly}>YOUR TEAM</div>
          {allies.map((slot, index) => {
            const active = picking?.side === 'ally' && picking.index === index;
            const champ = champions.find((row) => row.slug === slot.slug);
            const showSlug = active && locked ? locked.slug : slot.slug;
            const showName = active && locked ? locked.name : champ?.name;
            return (
              <button
                key={slot.lane}
                type="button"
                className={`${styles.slot} ${active ? styles.slotActive : ''} ${
                  index === mySlotIndex ? styles.slotMine : ''
                }`}
                onClick={() => setPicking({ side: 'ally', index })}
              >
                <div className={styles.slotAvatar}>{slotFace(showSlug, showName)}</div>
                <div>
                  <div className={styles.slotName}>{showName ?? (active ? 'Picking…' : '—')}</div>
                  <div className={styles.slotLane}>{slot.lane}</div>
                </div>
                {index === mySlotIndex ? <span className={styles.slotMineTag}>YOU</span> : null}
              </button>
            );
          })}

          <div className={styles.bansLabel}>YOUR BANS</div>
          {banTray('allyBans')}

          <div className={styles.bansLabel}>YOU ARE PLAYING</div>
          <div className={styles.laneChips}>
            {DRAFT_LANES.map((lane, index) => (
              <button
                key={lane}
                type="button"
                className={`${styles.laneChip} ${index === mySlotIndex ? styles.laneChipActive : ''}`}
                onClick={() => setState((cur) => ({ ...cur, mySlotIndex: index }))}
                aria-pressed={index === mySlotIndex}
              >
                {lane}
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.center}>
          <div className={styles.centerTop}>
            <div className={`${styles.timer} ${locked ? styles.timerLocked : ''}`}>
              <span className={styles.timerDot} />
              {locked ? `${locked.name} locked` : `Your pick · ${pickingLane}`}
            </div>
            <div className={styles.rank}>Tap a slot to fill the lobby</div>
            <div className={styles.spacer} />
            {locked ? (
              <button type="button" className={styles.undo} onClick={() => setLockedSlug(null)}>
                Undo pick
              </button>
            ) : null}
            {!isDraftEmpty(state) ? (
              <button type="button" className={styles.undo} onClick={reset}>
                Clear board
              </button>
            ) : null}
          </div>

          <h1 className={styles.heading}>
            {locked ? `${locked.name} is a good call` : `Pick these into ${pickingLane}`}
          </h1>
          <p className={styles.sub}>
            {enemyNames.length
              ? `Weighted against ${enemyNames.join(', ')}${pool.length ? ', and champions in your pool' : ''}.`
              : 'Fill their side to weight suggestions against the lane opponent.'}
          </p>

          <div className={styles.suggestions}>
            {suggestions.map((c, i) => {
              const isLocked = lockedSlug === c.slug;
              const art = portraits[c.slug];
              return (
                <div
                  key={c.slug}
                  className={`${styles.suggestion} ${i === 0 && !lockedSlug ? styles.suggestionTop : ''} ${isLocked ? styles.suggestionLocked : ''}`}
                >
                  <Link href={`/counters/${c.slug}`} className={styles.suggestionArt}>
                    {art ? <Image src={art} alt="" width={56} height={56} /> : initials(c.name)}
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
                      onClick={() => lockIn(c.slug)}
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
              {needs.map((need) => (
                <div key={need.trait} className={styles.need}>
                  <div className={styles.needRow}>
                    <span>{need.label}</span>
                    <span style={{ color: need.color }}>{need.status}</span>
                  </div>
                  <div className={styles.needTrack}>
                    <div
                      className={styles.needFill}
                      style={{ width: need.width, background: need.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>THREAT READ</div>
              <p className={styles.threat}>
                {enemyNames.length
                  ? `${enemyNames.join(' / ')} are locked. Suggestions use their ${pickingLane} win rates.`
                  : 'Lock enemy champs to tilt suggestions toward that lane.'}
              </p>
              {banNames.length ? (
                <p className={styles.threat}>
                  {banNames.join(', ')} {banNames.length === 1 ? 'is' : 'are'} banned and out of the
                  pool.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <aside className={styles.col}>
          <div className={styles.sideLabelEnemy}>ENEMY TEAM</div>
          {enemies.map((slot, index) => {
            const champ = champions.find((row) => row.slug === slot.slug);
            const active = picking?.side === 'enemy' && picking.index === index;
            return (
              <button
                key={slot.lane}
                type="button"
                className={`${styles.slot} ${active ? styles.slotActive : ''}`}
                onClick={() => setPicking({ side: 'enemy', index })}
              >
                <div className={styles.slotAvatar}>{slotFace(slot.slug, champ?.name)}</div>
                <div>
                  <div className={styles.slotName}>{champ?.name ?? '—'}</div>
                  <div className={styles.slotLane}>{slot.lane}</div>
                </div>
              </button>
            );
          })}
          <div className={styles.bansLabel}>THEIR BANS</div>
          {banTray('enemyBans')}
        </aside>
      </div>

      <DraftMobile
        champions={champions}
        portraits={portraits}
        placements={placements}
        state={state}
        picking={picking}
        locked={locked}
        suggestions={suggestions}
        needs={needs}
        enemyNames={enemyNames}
        pickingLane={pickingLane}
        onAllyTile={pickAlly}
        onAllyLane={markLane}
        onEnemyTile={(index) => setPicking({ side: 'enemy', index })}
        onBan={(side, index) => setPicking({ side, index })}
        onLock={lockIn}
        onUndo={() => setLockedSlug(null)}
        onReset={reset}
      />

      <ChampionPicker
        open={picking !== null && !lockedSlug}
        title={
          picking?.side === 'allyBans'
            ? 'Your team bans'
            : picking?.side === 'enemyBans'
              ? 'Enemy ban'
              : picking?.side === 'enemy'
                ? 'Enemy pick'
                : 'Your pick'
        }
        champions={champions}
        portraits={portraits}
        exclude={pickerExclude}
        onClose={() => setPicking(null)}
        onPick={(champion) => assign(champion.slug)}
      />
    </div>
  );
}
