'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ApiChampion, IconSignatureDto, TierPlacementDto } from '@/lib/api';
import { initials } from '@/lib/champions';
import { toIconReferences } from '@/lib/capture/to-draft-state';
import { useDraftCapture } from '@/lib/capture/use-draft-capture';
import { draftPhase, type DraftMode } from '@/lib/draft-copy';
import {
  firstPickKnown,
  formatClock,
  guessChampionLanes,
  isFlexPick,
  lockedPickCount,
  PHASE_BUDGET,
  phaseChrome,
} from '@/lib/draft-live';
import {
  createDraftSession,
  endDraftSession,
  persistDraftSession,
  shareUrlFor,
} from '@/lib/draft-sessions';
import { parsePlanId, type PlanId } from '@/lib/plans';
import {
  allySlotsInPickOrder,
  enemySlotsInPickOrder,
  bannedSlugs,
  clearDraftState,
  clearSlot,
  DRAFT_LANES,
  emptyDraftState,
  isDraftEmpty,
  loadDraftState,
  saveDraftState,
  setOverride,
  slotView,
  takenSlugs,
  type DraftState,
} from '@/lib/draft-state';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { ChampionPicker } from './ChampionPicker';
import { DraftGate } from './DraftGate';
import { DraftReady } from './DraftReady';
import { LaneGlyph } from './LaneGlyph';
import styles from './DraftBoard.module.css';
import { DraftMobile } from './DraftMobile';
import { DraftScreenRead } from './DraftScreenRead';
import { DraftShare } from './DraftShare';
import { Spinner } from './LoadState';
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
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<DraftMode>('Ranked');
  const [hydrated, setHydrated] = useState(false);
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [scanning, setScanning] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [phaseLeft, setPhaseLeft] = useState(30);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const sessionId = useRef<number | null>(null);
  /** False once the draft has ended, so late capture results are dropped. */
  const running = useRef(false);
  const references = useMemo(() => toIconReferences(signatures), [signatures]);
  const capture = useDraftCapture(references);

  const { allies, enemies, allyBans, enemyBans, mySlotIndex } = state;
  const allyOrder = useMemo(() => allySlotsInPickOrder(state), [state]);
  const enemyOrder = useMemo(() => enemySlotsInPickOrder(state), [state]);

  useEffect(() => {
    const restored = loadDraftState();
    if (restored) {
      setState(restored);
      if (!isDraftEmpty(restored)) {
        setStarted(true);
        running.current = true;
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!started && isDraftEmpty(state)) {
      clearDraftState();
      return;
    }
    saveDraftState(state);
  }, [hydrated, started, state]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setPlan('Free');
      return;
    }
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setPlan('Free');
        setUserId(null);
        return;
      }
      setUserId(data.user.id);
      const [profileRes, poolRes] = await Promise.all([
        supabase.from('profiles').select('plan').eq('id', data.user.id).maybeSingle(),
        supabase
          .from('user_champion_pool')
          .select('champion_slug')
          .eq('user_id', data.user.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);
      setPlan(parsePlanId((profileRes.data as { plan?: string } | null)?.plan));
      setPool(
        ((poolRes.data ?? []) as Array<{ champion_slug: string }>).map((row) => row.champion_slug),
      );
    });
  }, []);

  const capturePhase = capture.lastRead?.phase ?? null;
  const chrome = phaseChrome(capturePhase, lockedPickCount(state));

  useEffect(() => {
    if (!started) return;
    const tick = window.setInterval(() => {
      const start = state.startedAt ?? Date.now();
      setElapsed(Math.max(0, Math.round((Date.now() - start) / 1000)));
      setPhaseLeft((left) => Math.max(0, left - 1));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [started, state.startedAt]);

  useEffect(() => {
    setPhaseLeft(PHASE_BUDGET[capturePhase ?? 'pick'] ?? 30);
  }, [capturePhase]);

  useEffect(() => {
    setScanning(capture.status === 'armed' || capture.status === 'reading' || capture.status === 'arming');
  }, [capture.status]);

  useEffect(() => {
    capture.disarm();
  }, [resetToken, capture.disarm]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const applyGen = useRef(0);

  useEffect(() => {
    applyGen.current += 1;
  }, [resetToken]);

  useEffect(() => {
    const armed = capture.status === 'armed' || capture.status === 'reading';
    if (!armed) return;
    const tick = window.setInterval(() => {
      const gen = applyGen.current;
      void capture.capture(stateRef.current).then((applied) => {
        if (gen !== applyGen.current || !applied || !running.current) return;
        setState(applied.state);
        setLockedSlug(null);
      });
    }, 900);
    return () => window.clearInterval(tick);
  }, [capture.status, capture.capture]);

  useEffect(() => {
    const armed = capture.status === 'armed' || capture.status === 'reading';
    if (!armed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'r' && event.key !== 'R') return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      const gen = applyGen.current;
      void capture.capture(state).then((applied) => {
        if (gen !== applyGen.current || !applied || !running.current) return;
        setState(applied.state);
        setLockedSlug(null);
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [capture, state]);

  useEffect(() => {
    if (!userId || sessionId.current == null || !started) return;
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const id = sessionId.current;
    const handle = window.setTimeout(() => {
      void persistDraftSession(supabase, id, state);
    }, 1200);
    return () => window.clearTimeout(handle);
  }, [state, started, userId]);

  const phase = hydrated && plan
    ? draftPhase(plan, started, started && !isDraftEmpty(state))
    : null;
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

  function lockIn(slug: string) {
    setLockedSlug(slug);
    const index = picking?.side === 'ally' ? picking.index : mySlotIndex;
    setState((cur) => ({
      ...cur,
      allies: cur.allies.map((item, i) => (i === index ? { ...item, slug } : item)),
    }));
    setPicking(null);
  }

  /**
   * Ending the draft has to survive a capture that is already in flight. The
   * capture bar unmounts on the same commit, so its own guard never runs and the
   * pending read would otherwise land on the cleared board and be persisted again.
   */
  function reset() {
    running.current = false;
    setResetToken((token) => token + 1);
    setScanning(false);
    setShareOpen(false);
    const ended = state;
    const id = sessionId.current;
    const uid = userId;
    sessionId.current = null;
    setShareToken(null);
    setState(emptyDraftState());
    setLockedSlug(null);
    setPicking(null);
    setStarted(false);
    clearDraftState();
    if (id != null && uid && isSupabaseConfigured()) {
      const supabase = createClient();
      void capture.snapshot().then((blob) =>
        endDraftSession(
          supabase,
          uid,
          id,
          ended,
          blob ? { blob, kind: 'screenshot' } : undefined,
        ),
      );
    }
  }

  function startDraft() {
    running.current = true;
    setStarted(true);
    setElapsed(0);
    setPhaseLeft(30);
    const next = {
      ...emptyDraftState(),
      mySlotIndex: state.mySlotIndex,
      startedAt: Date.now(),
    };
    setState(next);
    if (userId && isSupabaseConfigured()) {
      const supabase = createClient();
      void createDraftSession(supabase, userId, next, 'manual').then((created) => {
        if (!created) return;
        sessionId.current = created.id;
        setShareToken(created.shareToken);
      });
    }
  }

  function pickReadyLane(lane: (typeof DRAFT_LANES)[number]) {
    const index = DRAFT_LANES.indexOf(lane);
    setState((cur) => ({ ...cur, mySlotIndex: index >= 0 ? index : 0 }));
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
    if (scanning) return <Spinner />;
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
              className={`${styles.ban} ${slug ? styles.banFilled : ''} ${
                scanning && !slug ? styles.banPending : ''
              }`}
              onClick={() => setPicking({ side, index })}
              title={champ?.name ?? (scanning ? 'Reading ban' : 'Empty ban')}
            >
              {art ? (
                <Image src={art} alt="" width={32} height={32} />
              ) : slug ? (
                (champ?.name.slice(0, 1) ?? '?')
              ) : scanning ? (
                <Spinner />
              ) : (
                '—'
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (!hydrated || !phase) {
    return <div className={styles.wrap} />;
  }

  if (phase === 'gated') {
    return (
      <div className={styles.wrap}>
        <DraftGate champions={champions} portraits={portraits} />
      </div>
    );
  }

  if (phase === 'ready') {
    return (
      <div className={styles.wrap}>
        <DraftReady
          champions={champions}
          portraits={portraits}
          pool={pool}
          mode={mode}
          lane={myLane}
          onMode={setMode}
          onLane={pickReadyLane}
          onStart={startDraft}
          userId={userId}
        />
      </div>
    );
  }

  const reviewByKey = new Map(
    (capture.lastRead?.review ?? []).map((slot) => [`${slot.role}-${slot.index}`, slot]),
  );
  const shareLink = shareToken ? shareUrlFor(shareToken) : null;
  const showFirst = firstPickKnown(state);

  return (
    <div className={styles.wrap}>
      <div className={styles.board}>
        <aside className={styles.col}>
          <div className={styles.sideHead}>
            <div className={styles.sideLabelAlly} style={{ marginBottom: 0 }}>
              YOUR TEAM
            </div>
            {showFirst ? <div className={styles.firstPickTag}>1ST PICK</div> : null}
          </div>
          <div className={styles.bansLabel} style={{ marginTop: 0 }}>
            BANS
          </div>
          {banTray('allyBans')}
          {allyOrder.map((slot, order) => {
            const index = slot.boardIndex;
            const view = slotView(state, 'ally', index);
            const active = picking?.side === 'ally' && picking.index === index;
            const champ = champions.find((row) => row.slug === view.slug);
            const showSlug = active && locked ? locked.slug : view.slug;
            const showName = active && locked ? locked.name : champ?.name;
            const review = reviewByKey.get(`ally-${index}`);
            const low = Boolean(review && !view.isManual);
            return (
              <div
                key={slot.lane}
                className={`${styles.slot} ${active ? styles.slotActive : ''} ${
                  index === mySlotIndex ? styles.slotMine : ''
                } ${view.isPre ? styles.slotPre : ''}`}
              >
                <button
                  type="button"
                  className={styles.slotRow}
                  onClick={() => setPicking({ side: 'ally', index })}
                >
                  <span className={styles.slotGlyph}>
                    <LaneGlyph lane={slot.lane} size={13} />
                  </span>
                  <div
                    className={`${styles.slotAvatar} ${scanning && !showSlug ? styles.slotPending : ''} ${
                      view.isPre ? styles.slotAvatarDim : ''
                    }`}
                  >
                    {slotFace(showSlug, showName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.slotNameRow}>
                      <div className={styles.slotName}>
                        {showName ?? (active ? 'Picking…' : scanning ? 'Reading…' : 'Not picked yet')}
                      </div>
                      {index === mySlotIndex ? <span className={styles.slotMineTag}>YOU</span> : null}
                      {showFirst && order === 0 ? <span className={styles.slotFirst}>1ST</span> : null}
                    </div>
                    <div className={styles.slotLane}>{slot.lane} lane</div>
                  </div>
                  {view.slug && !view.isPre ? (
                    <span
                      className={styles.slotDel}
                      role="button"
                      tabIndex={0}
                      title="Clear this pick"
                      onClick={(event) => {
                        event.stopPropagation();
                        setState((cur) => clearSlot(cur, `ally-${index}`));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setState((cur) => clearSlot(cur, `ally-${index}`));
                        }
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                        <path d="M5 5l14 14M19 5L5 19" />
                      </svg>
                    </span>
                  ) : null}
                </button>
                {view.isPre ? (
                  <div className={styles.slotPreNote}>
                    <span className={styles.slotPreDot} />
                    PRE-PICK · NOT LOCKED
                  </div>
                ) : null}
                {low || view.isManual ? (
                  <div className={styles.slotConf}>
                    <span
                      className={styles.slotConfTag}
                      style={{
                        color: view.isManual ? '#9FCBE4' : '#F0A87B',
                        background: view.isManual ? 'rgba(159,203,228,.12)' : 'rgba(240,168,123,.14)',
                      }}
                    >
                      {view.isManual ? 'SET BY YOU' : `${Math.round((review?.confidence ?? 0) * 100)}% MATCH`}
                    </span>
                    <button
                      type="button"
                      className={styles.slotFix}
                      onClick={() => setPicking({ side: 'ally', index })}
                    >
                      Fix
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

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
                <LaneGlyph lane={lane} />
                {lane}
              </button>
            ))}
          </div>
          <DraftScreenRead
            status={capture.status}
            calib={capture.calib}
            previewUrl={capture.previewUrl}
            profile={capture.profile}
            lastRead={capture.lastRead}
            error={capture.error}
            onArm={() => void capture.arm()}
            onCalibrate={() => void capture.calibrate()}
            onDisarm={capture.disarm}
          />
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
            <div className={styles.clocks}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B87A8" strokeWidth="2.2">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
              </svg>
              <span>{formatClock(elapsed)}</span>
              <span className={styles.clockSplit} />
              <span style={{ color: chrome.color }}>{formatClock(phaseLeft)}</span>
            </div>
            {showFirst ? <div className={styles.firstPickSide}>FIRST PICK</div> : null}
            <div className={styles.spacer} />
            <div className={styles.shareWrap}>
              <button type="button" className={styles.shareBtn} onClick={() => setShareOpen((open) => !open)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                  <circle cx="18" cy="5.5" r="2.6" />
                  <circle cx="6" cy="12" r="2.6" />
                  <circle cx="18" cy="18.5" r="2.6" />
                  <path d="M8.4 10.7l7.2-3.9M8.4 13.3l7.2 3.9" />
                </svg>
                Share
                <span className={styles.shareWatch}>
                  <span className={styles.shareDot} />
                  {shareToken ? 'Live' : 'Off'}
                </span>
              </button>
              {shareOpen ? (
                <DraftShare
                  link={shareLink}
                  signedIn={Boolean(userId)}
                  onClose={() => setShareOpen(false)}
                />
              ) : null}
            </div>
            {locked ? (
              <button type="button" className={styles.undo} onClick={() => setLockedSlug(null)}>
                Undo pick
              </button>
            ) : null}
            <button type="button" className={styles.end} onClick={reset}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              End draft
            </button>
          </div>
          <div className={styles.phaseMeta}>
            {chrome.name} · {mode}
            {capture.calib === 'done' ? ' · recording this session' : ''}
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
          <div className={styles.sideHead}>
            <div className={styles.sideLabelEnemy} style={{ marginBottom: 0 }}>
              ENEMY TEAM
            </div>
            <div className={styles.sideCount}>
              {state.enemies.filter((slot) => slot.slug).length} of 5
            </div>
          </div>
          <div className={styles.sideHint}>
            Lanes are not shown in champion select, so these are read from pick order and their pool.
          </div>
          <div className={styles.bansLabel} style={{ marginTop: 0 }}>
            BANS
          </div>
          {banTray('enemyBans')}
          {enemyOrder.map((slot, order) => {
            const index = slot.boardIndex;
            const view = slotView(state, 'enemy', index);
            const champ = champions.find((row) => row.slug === view.slug);
            const active = picking?.side === 'enemy' && picking.index === index;
            const guesses = guessChampionLanes(view.slug, placements);
            const review = reviewByKey.get(`enemy-${index}`);
            const low = Boolean(review && !view.isManual);
            return (
              <div
                key={`${slot.lane}-${index}`}
                className={`${styles.slot} ${active ? styles.slotActive : ''}`}
              >
                <button
                  type="button"
                  className={styles.slotRow}
                  onClick={() => setPicking({ side: 'enemy', index })}
                >
                  <span className={styles.enemyOrder}>PICK {order + 1}</span>
                  <div className={`${styles.slotAvatar} ${scanning && !view.slug ? styles.slotPending : ''}`}>
                    {slotFace(view.slug, champ?.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.slotName}>
                      {champ?.name ?? (scanning ? 'Reading…' : 'Not picked yet')}
                    </div>
                    {guesses[0] ? (
                      <div className={styles.laneGuess}>
                        <LaneGlyph lane={guesses[0].lane} size={10} />
                        {guesses[0].lane} {guesses[0].pct}%
                        {isFlexPick(guesses) ? <span className={styles.flexTag}>FLEX</span> : null}
                      </div>
                    ) : null}
                  </div>
                  {view.slug ? (
                    <span
                      className={styles.slotDel}
                      role="button"
                      tabIndex={0}
                      title="Clear this pick"
                      onClick={(event) => {
                        event.stopPropagation();
                        setState((cur) => clearSlot(cur, `enemy-${index}`));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setState((cur) => clearSlot(cur, `enemy-${index}`));
                        }
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                        <path d="M5 5l14 14M19 5L5 19" />
                      </svg>
                    </span>
                  ) : null}
                </button>
                {guesses.length > 1 ? (
                  <div className={styles.guessList}>
                    {guesses.map((guess, i) => (
                      <div key={guess.lane} className={styles.guessRow}>
                        <LaneGlyph lane={guess.lane} size={9} />
                        <span className={styles.guessLane} style={{ color: i === 0 ? '#DEDCEE' : '#7B769B' }}>
                          {guess.lane}
                        </span>
                        <span className={styles.guessTrack}>
                          <span
                            className={styles.guessFill}
                            style={{
                              width: `${guess.pct}%`,
                              background: i === 0 ? '#E58B7B' : 'rgba(229,139,123,.4)',
                            }}
                          />
                        </span>
                        <span className={styles.guessPct} style={{ color: i === 0 ? '#DEDCEE' : '#7B769B' }}>
                          {guess.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {low || view.isManual ? (
                  <div className={styles.slotConf} style={{ paddingLeft: 44 }}>
                    <span
                      className={styles.slotConfTag}
                      style={{
                        color: view.isManual ? '#9FCBE4' : '#F0A87B',
                        background: view.isManual ? 'rgba(159,203,228,.12)' : 'rgba(240,168,123,.14)',
                      }}
                    >
                      {view.isManual ? 'SET BY YOU' : `${Math.round((review?.confidence ?? 0) * 100)}% MATCH`}
                    </span>
                    <button
                      type="button"
                      className={styles.slotFix}
                      onClick={() => setPicking({ side: 'enemy', index })}
                    >
                      Fix
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
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
        onClear={(key) => setState((cur) => clearSlot(cur, key))}
        onLock={lockIn}
        onUndo={() => setLockedSlug(null)}
        onReset={reset}
        mode={mode}
        scanning={scanning}
        chrome={chrome}
        elapsed={elapsed}
        phaseLeft={phaseLeft}
        firstPick={showFirst}
        shareOpen={shareOpen}
        shareLink={shareLink}
        signedIn={Boolean(userId)}
        onShare={() => setShareOpen(true)}
        onCloseShare={() => setShareOpen(false)}
        capture={{
          status: capture.status,
          calib: capture.calib,
          previewUrl: capture.previewUrl,
          profile: capture.profile,
          lastRead: capture.lastRead,
          error: capture.error,
          onArm: () => void capture.arm(),
          onCalibrate: () => void capture.calibrate(),
          onDisarm: capture.disarm,
        }}
      />

      <ChampionPicker
        open={picking !== null && !lockedSlug}
        kicker={
          picking && (reviewByKey.has(`${picking.side === 'allyBans' ? 'ban-ally' : picking.side === 'enemyBans' ? 'ban-enemy' : picking.side}-${picking.index}`) ||
            Boolean(state.overrides[`${picking.side === 'allyBans' ? 'ban-ally' : picking.side === 'enemyBans' ? 'ban-enemy' : picking.side}-${picking.index}`]))
            ? 'MANUAL OVERRIDE'
            : undefined
        }
        title={
          picking?.side === 'allyBans'
            ? 'Your team bans'
            : picking?.side === 'enemyBans'
              ? 'Enemy ban'
              : picking?.side === 'enemy'
                ? 'Set this slot yourself'
                : 'Set this slot yourself'
        }
        note="Pick the champion you can see. Scoring updates immediately. Overrides stick for the rest of this draft."
        champions={champions}
        portraits={portraits}
        exclude={pickerExclude}
        onClose={() => setPicking(null)}
        onPick={(champion) => {
          if (!picking) return;
          const key =
            picking.side === 'allyBans'
              ? `ban-ally-${picking.index}`
              : picking.side === 'enemyBans'
                ? `ban-enemy-${picking.index}`
                : `${picking.side}-${picking.index}`;
          setState((cur) => setOverride(cur, key, champion.slug));
          setLockedSlug(null);
          setPicking(null);
        }}
      />
    </div>
  );
}
