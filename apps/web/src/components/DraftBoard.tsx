'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ApiChampion, TierPlacementDto } from '@/lib/api';
import { initials } from '@/lib/champions';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { ChampionPicker } from './ChampionPicker';
import styles from './DraftBoard.module.css';
import { compNeeds, rankDraftSuggestions, type DraftPlacement } from '@wild-rift-forge/game-data';

const LANES = ['Top', 'Jungle', 'Mid', 'Dragon', 'Support'] as const;

type Slot = { lane: (typeof LANES)[number]; slug: string | null };

function toPlacement(
  slug: string,
  lane: (typeof LANES)[number],
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

export function DraftBoard({
  champions = [],
  portraits = {},
  placements = [],
}: {
  champions?: ApiChampion[];
  portraits?: Record<string, string>;
  placements?: TierPlacementDto[];
}) {
  const [allies, setAllies] = useState<Slot[]>(() => LANES.map((lane) => ({ lane, slug: null })));
  const [enemies, setEnemies] = useState<Slot[]>(() => LANES.map((lane) => ({ lane, slug: null })));
  const [bans, setBans] = useState<Array<string | null>>([null, null, null, null, null]);
  const [picking, setPicking] = useState<{ side: 'ally' | 'enemy' | 'ban'; index: number } | null>(null);
  const [lockedSlug, setLockedSlug] = useState<string | null>(null);
  const [pool, setPool] = useState<string[]>([]);

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

  const pickingLane: (typeof LANES)[number] =
    (picking && picking.side !== 'ban'
      ? (picking.side === 'ally' ? allies : enemies)[picking.index]?.lane
      : allies.find((slot) => !slot.slug)?.lane) ?? 'Top';
  const taken = useMemo(() => {
    const set = new Set<string>();
    for (const slot of [...allies, ...enemies, ...bans]) {
      const slug = typeof slot === 'string' || slot === null ? slot : slot.slug;
      if (slug) set.add(slug);
    }
    return set;
  }, [allies, enemies, bans]);

  const suggestions = useMemo(() => {
    const lane = pickingLane;
    const enemySlot = enemies.find((slot) => slot.lane === lane);
    const enemy = enemySlot?.slug ? toPlacement(enemySlot.slug, lane, champions, placements) : null;
    const candidates = placements
      .filter((row) => row.lane === lane)
      .map((row) => toPlacement(row.slug, lane, champions, placements))
      .filter((row): row is DraftPlacement => Boolean(row));
    const fallback = champions.map((champ) => toPlacement(champ.slug, lane, champions, placements)).filter((row): row is DraftPlacement => Boolean(row));
    return rankDraftSuggestions(candidates.length ? candidates : fallback, enemy, new Set(pool), taken, 3);
  }, [champions, enemies, pickingLane, placements, pool, taken]);

  const locked = suggestions.find((row) => row.slug === lockedSlug) ?? null;
  const allyRoles = allies.map((slot) => {
    const champ = champions.find((row) => row.slug === slot.slug);
    return champ?.roles ?? [];
  });
  const needs = compNeeds(allyRoles);
  const enemyNames = enemies.filter((slot) => slot.slug).map((slot) => champions.find((c) => c.slug === slot.slug)?.name ?? slot.slug);

  function assign(slug: string) {
    if (!picking) return;
    if (picking.side === 'ban') {
      setBans((cur) => cur.map((item, i) => (i === picking.index ? slug : item)));
    } else if (picking.side === 'ally') {
      setAllies((cur) => cur.map((item, i) => (i === picking.index ? { ...item, slug } : item)));
    } else {
      setEnemies((cur) => cur.map((item, i) => (i === picking.index ? { ...item, slug } : item)));
    }
    setLockedSlug(null);
    setPicking(null);
  }

  function slotFace(slug: string | null, name?: string) {
    const art = slug ? portraits[slug] : undefined;
    if (art) return <Image src={art} alt="" width={38} height={38} />;
    if (name) return initials(name);
    return '—';
  }

  return (
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
              className={`${styles.slot} ${active ? styles.slotActive : ''}`}
              onClick={() => setPicking({ side: 'ally', index })}
            >
              <div className={styles.slotAvatar}>{slotFace(showSlug, showName)}</div>
              <div>
                <div className={styles.slotName}>{showName ?? (active ? 'Picking…' : '—')}</div>
                <div className={styles.slotLane}>{slot.lane}</div>
              </div>
            </button>
          );
        })}
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
                    onClick={() => {
                      setLockedSlug(c.slug);
                      const empty = allies.findIndex((slot) => !slot.slug);
                      const index = picking?.side === 'ally' ? picking.index : empty >= 0 ? empty : 0;
                      setAllies((cur) => cur.map((item, i) => (i === index ? { ...item, slug: c.slug } : item)));
                      setPicking(null);
                    }}
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
            {needs.map((n) => (
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
              {enemyNames.length
                ? `${enemyNames.join(' / ')} are locked. Suggestions use their ${pickingLane} win rates.`
                : 'Lock enemy champs to tilt suggestions toward that lane.'}
            </p>
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
        <div className={styles.bansLabel}>BANS</div>
        <div className={styles.bans}>
          {bans.map((slug, index) => (
            <button
              key={index}
              type="button"
              className={styles.ban}
              onClick={() => setPicking({ side: 'ban', index })}
            >
              {slug ? (champions.find((row) => row.slug === slug)?.name.slice(0, 1) ?? '?') : '—'}
            </button>
          ))}
        </div>
      </aside>

      <ChampionPicker
        open={picking !== null && !lockedSlug}
        title={
          picking?.side === 'ban' ? 'Ban a champion' : picking?.side === 'enemy' ? 'Enemy pick' : 'Your pick'
        }
        champions={champions}
        portraits={portraits}
        exclude={[...taken]}
        onClose={() => setPicking(null)}
        onPick={(champion) => assign(champion.slug)}
      />
    </div>
  );
}
