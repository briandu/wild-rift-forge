'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { TierLane } from '@wild-rift-forge/game-data';
import { useChampionAvatar } from '@/hooks/useChampionAvatar';
import { dropLine, useRankDrag } from '@/hooks/useRankDrag';
import type { ApiChampion, TierPlacementDto } from '@/lib/api';
import {
  ACCOUNT_CHANNELS,
  ACCOUNT_REGIONS,
  loadAccountState,
  patchProfile,
  savePoolOrder,
  type AccountChannel,
  type AccountProfile,
  type AccountRegion,
  type SavedMatchupRow,
} from '@/lib/account';
import { portraitsFromRoster, roleLabel } from '@/lib/champions';
import { savedLaneVerdict } from '@/lib/matchup-card';
import { UpgradePlans } from './UpgradePlans';
import {
  bestPlacement,
  formatRate,
  parseTierLane,
  placementsForSlug,
} from '@/lib/placements';
import {
  POOL_SORTS,
  mergeLaneOrder,
  movePoolItem,
  poolScopeLabel,
  poolSortHint,
  reorderByDrop,
  sortPool,
  type PoolSort,
} from '@/lib/pool-rank';
import {
  DEFAULT_ROLE_ORDER,
  roleCountLabel,
  roleRankTag,
} from '@/lib/roles';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { accountHeadingName } from '@/lib/user-name';
import { ChampFace } from './ChampFace';
import { ChampionPicker } from './ChampionPicker';
import { LaneGlyph } from './LaneGlyph';
import { PendingLabel } from './LoadState';
import styles from './AccountView.module.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pool', label: 'Champion pool' },
  { id: 'saved', label: 'Saved' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'plan', label: 'Plan' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];
type SavedPair = SavedMatchupRow & {
  you: string;
  them: string;
  verdict: string;
  side: 'you' | 'them' | 'even';
};

const LANES = ['All', 'Top', 'Jungle', 'Mid', 'Dragon', 'Support'] as const;
const NOTIFS = [
  {
    k: 'pool',
    name: 'Patch changes to my pool',
    note: 'Email when a patch note names a champion in your pool.',
  },
  {
    k: 'tier',
    name: 'Tier shifts in my lanes',
    note: 'Email when a pool champion moves a full S/A/B/C letter.',
  },
  {
    k: 'counters',
    name: 'New counters worth learning',
    note: 'Not sent yet — pairwise counter history is not ingested.',
  },
  {
    k: 'digest',
    name: 'Weekly digest',
    note: 'One summary on Monday instead of alerts through the week.',
  },
] as const;

function tabFrom(value: string | null): TabId {
  return TABS.some((tab) => tab.id === value) ? (value as TabId) : 'overview';
}

function sideTone(side: SavedPair['side']) {
  if (side === 'them') {
    return { c: '#E58B7B', bg: 'rgba(229,139,123,.12)', bd: 'rgba(229,139,123,.38)' };
  }
  if (side === 'you') {
    return { c: '#8FEDB8', bg: 'rgba(123,224,168,.12)', bd: 'rgba(123,224,168,.38)' };
  }
  return { c: '#F0A87B', bg: 'rgba(240,168,123,.12)', bd: 'rgba(240,168,123,.38)' };
}

function nameFor(slug: string, champions: ApiChampion[]): string {
  return champions.find((champion) => champion.slug === slug)?.name ?? slug;
}

function slugFor(name: string, champions: ApiChampion[]): string | undefined {
  return champions.find((champion) => champion.name === name)?.slug;
}

function champFor(name: string, champions: ApiChampion[]): ApiChampion | undefined {
  return champions.find((champion) => champion.name === name);
}

function playsLane(placements: TierPlacementDto[], slug: string, lane: string): boolean {
  if (lane === 'All') return true;
  return placementsForSlug(placements, slug).some((row) => row.lane === lane);
}

function toSavedPair(
  row: SavedMatchupRow,
  champions: ApiChampion[],
  placements: TierPlacementDto[],
): SavedPair {
  const you = nameFor(row.youSlug, champions);
  const them = nameFor(row.themSlug, champions);
  const lane = parseTierLane(row.lane);
  const youRow = lane
    ? placements.find((item) => item.slug === row.youSlug && item.lane === lane)
    : undefined;
  const themRow = lane
    ? placements.find((item) => item.slug === row.themSlug && item.lane === lane)
    : undefined;
  const { side, verdict } = savedLaneVerdict(you, them, youRow?.winRate, themRow?.winRate);
  return { ...row, you, them, side, verdict };
}

const EMPTY_PROFILE: AccountProfile = {
  riotId: null,
  region: 'NA',
  notifyPool: true,
  notifyTier: true,
  notifyCounters: false,
  notifyDigest: true,
  channel: 'Email',
  proWaitlisted: false,
  preferredRoles: [...DEFAULT_ROLE_ORDER],
};

function DragHandle() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="#5C5878" aria-hidden>
      <circle cx="2" cy="3" r="1.4" />
      <circle cx="8" cy="3" r="1.4" />
      <circle cx="2" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="2" cy="13" r="1.4" />
      <circle cx="8" cy="13" r="1.4" />
    </svg>
  );
}

export function AccountView({
  champions = [],
  placements = [],
}: {
  champions?: ApiChampion[];
  placements?: TierPlacementDto[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFrom(searchParams.get('tab'));
  const portraits = portraitsFromRoster(champions);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AccountProfile>(EMPTY_PROFILE);
  const [riotDraft, setRiotDraft] = useState('');
  const [pool, setPool] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedMatchupRow[]>([]);
  const [poolLane, setPoolLane] = useState<(typeof LANES)[number]>('All');
  const [poolSort, setPoolSort] = useState<PoolSort>('Custom');
  const [poolQ, setPoolQ] = useState('');
  const [emailEdit, setEmailEdit] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const { url: avatarUrl, choose } = useChampionAvatar(user);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;
    const supabase = createClient();
    void loadAccountState(supabase, user.id).then((state) => {
      setProfile(state.profile);
      setPool(state.pool);
      setSaved(state.saved);
    });
  }, [user]);

  const email = user?.email ?? 'you@example.com';
  const riotConnected = Boolean(profile.riotId);
  const riotId = profile.riotId || 'No Riot ID';
  const displayName = accountHeadingName(user);
  const savedPairs = useMemo(
    () => saved.map((row) => toSavedPair(row, champions, placements)),
    [saved, champions, placements],
  );

  const preferredLane = poolLane === 'All' ? profile.preferredRoles : poolLane;
  const inLane = (slug: string) => playsLane(placements, slug, poolLane);
  const placeOf = (slug: string) =>
    bestPlacement(placementsForSlug(placements, slug), preferredLane);
  const winRateOf = (slug: string) => placeOf(slug)?.winRate ?? 0;
  const volumeOf = (slug: string) => placeOf(slug)?.pickRate ?? 0;

  const visibleSlugs = useMemo(
    () => sortPool(pool.filter(inLane), poolSort, winRateOf, volumeOf),
    [pool, poolLane, poolSort, placements],
  );

  const poolCards = useMemo(
    () =>
      visibleSlugs.map((slug) => {
        const place = placeOf(slug);
        return {
          slug,
          name: nameFor(slug, champions),
          role: place?.lane ?? roleLabel(champFor(nameFor(slug, champions), champions)?.roles ?? []),
          wr: place ? formatRate(place.winRate) : '—',
          wrc: place ? (place.winRate >= 52 ? '#8FEDB8' : '#F0A87B') : '#8B87A8',
          games: riotConnected
            ? place
              ? `${formatRate(place.pickRate)} pick`
              : '—'
            : 'Connect Riot ID',
        };
      }),
    [champions, placements, poolLane, riotConnected, visibleSlugs],
  );

  const poolResults = useMemo(() => {
    const q = poolQ.trim().toLowerCase();
    const taken = new Set(pool);
    return champions
      .filter((champion) => !taken.has(champion.slug))
      .filter((champion) =>
        q
          ? champion.name.toLowerCase().includes(q) || champion.slug.includes(q)
          : inLane(champion.slug),
      )
      .sort((a, b) => winRateOf(b.slug) - winRateOf(a.slug) || a.name.localeCompare(b.name))
      .slice(0, q ? 8 : 5)
      .map((champion) => {
        const place = placeOf(champion.slug);
        return {
          slug: champion.slug,
          name: champion.name,
          role: place?.lane ?? roleLabel(champion.roles),
          wr: place ? formatRate(place.winRate) : '—',
          wrc: place ? (place.winRate >= 52 ? '#8FEDB8' : '#F0A87B') : '#8B87A8',
        };
      });
  }, [champions, placements, pool, poolLane, poolQ]);

  const stats = [
    { v: riotConnected ? profile.region : '—', k: 'REGION', c: '#8FEDB8' },
    { v: String(pool.length), k: 'POOL', c: '#DEDCEE' },
    { v: String(saved.length), k: 'SAVED', c: '#DEDCEE' },
    { v: 'Beta', k: 'PLAN', c: '#DEDCEE' },
  ];

  function goTab(id: TabId) {
    setDeleteConfirm(false);
    setEmailEdit(false);
    router.replace(id === 'overview' ? '/me' : `/me?tab=${id}`, { scroll: false });
  }

  async function signOut() {
    if (isSupabaseConfigured()) {
      await createClient().auth.signOut();
      setUser(null);
    }
    router.replace('/');
    router.refresh();
  }

  async function persistProfile(patch: Record<string, unknown>, next: AccountProfile, ok: string) {
    if (!user || !isSupabaseConfigured()) {
      setProfile(next);
      setNotice(ok);
      return;
    }
    try {
      await patchProfile(createClient(), user.id, patch);
      setProfile(next);
      setNotice(ok);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save.');
    }
  }

  async function persistOrder(next: string[], ok?: string) {
    setPool(next);
    if (ok) setNotice(ok);
    if (user && isSupabaseConfigured()) {
      try {
        await savePoolOrder(createClient(), user.id, next);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not save pool order.');
      }
    }
  }

  async function addPool(name: string) {
    const slug = slugFor(name, champions);
    if (!slug || adding) return;
    setAdding(slug);
    try {
      const next = pool.includes(slug) ? pool : [...pool, slug];
      setPoolQ('');
      setNotice(`${name} added to your pool.`);
      if (user && isSupabaseConfigured()) {
        const supabase = createClient();
        await supabase.rpc('ensure_default_avatar');
        const { error } = await supabase.from('user_champion_pool').insert({
          user_id: user.id,
          champion_slug: slug,
          sort_order: next.length - 1,
        });
        if (error && !error.message.includes('duplicate')) {
          setNotice(error.message);
          return;
        }
      }
      void persistOrder(next);
    } finally {
      setAdding(null);
    }
  }

  function movePool(slug: string, dir: -1 | 1) {
    const customVisible = pool.filter(inLane);
    const next = mergeLaneOrder(pool, movePoolItem(customVisible, slug, dir), inLane);
    setPoolSort('Custom');
    void persistOrder(next);
  }

  function dropPool(from: string, to: string) {
    const customVisible = pool.filter(inLane);
    const next = mergeLaneOrder(pool, reorderByDrop(customVisible, from, to), inLane);
    setPoolSort('Custom');
    void persistOrder(next);
  }

  function moveRole(role: TierLane, dir: -1 | 1) {
    const next = movePoolItem(profile.preferredRoles, role, dir) as TierLane[];
    if (next[0] === profile.preferredRoles[0] && next.every((item, i) => item === profile.preferredRoles[i])) {
      return;
    }
    void persistProfile(
      { preferred_roles: next },
      { ...profile, preferredRoles: next },
      `${next[0]} is now your primary role.`,
    );
  }

  function dropRole(from: TierLane, to: TierLane) {
    const next = reorderByDrop(profile.preferredRoles, from, to);
    if (next.every((item, i) => item === profile.preferredRoles[i])) return;
    void persistProfile(
      { preferred_roles: next },
      { ...profile, preferredRoles: next },
      `${next[0]} is now your primary role.`,
    );
  }

  function commitPoolOrder() {
    const next = mergeLaneOrder(pool, visibleSlugs, inLane);
    const label = poolSort.toLowerCase();
    setPoolSort('Custom');
    void persistOrder(next, `Pool reordered by ${label} for ${poolScopeLabel(poolLane)}.`);
  }

  async function removePool(name: string) {
    const slug = slugFor(name, champions);
    if (!slug) return;
    setPool((cur) => cur.filter((item) => item !== slug));
    setNotice(`${name} removed from your pool.`);
    if (user && isSupabaseConfigured()) {
      await createClient()
        .from('user_champion_pool')
        .delete()
        .eq('user_id', user.id)
        .eq('champion_slug', slug);
    }
  }

  async function removeSaved(pair: SavedPair) {
    setSaved((cur) =>
      cur.filter(
        (row) =>
          !(
            row.youSlug === pair.youSlug &&
            row.themSlug === pair.themSlug &&
            row.lane === pair.lane
          ),
      ),
    );
    setNotice(`${pair.you} vs ${pair.them} removed.`);
    if (user && isSupabaseConfigured()) {
      await createClient()
        .from('user_saved_matchups')
        .delete()
        .eq('user_id', user.id)
        .eq('you_slug', pair.youSlug)
        .eq('them_slug', pair.themSlug)
        .eq('lane', pair.lane);
    }
  }

  return (
    <div>
      <header className={styles.hero}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.heroInner}>
          <div className={styles.identity}>
            <button
              type="button"
              className={styles.avatar}
              onClick={() => user && setPickerOpen(true)}
              aria-label="Change avatar"
            >
              {avatarUrl ? <Image src={avatarUrl} alt="" width={78} height={78} /> : null}
            </button>
            <div className={styles.identityCopy}>
              <div className={styles.kicker}>ACCOUNT</div>
              <h1 className={styles.name} title={displayName}>
                {displayName}
              </h1>
              <p
                className={styles.meta}
                title={`${email} · ${riotConnected ? riotId : 'Not connected'}`}
              >
                {email} · {riotConnected ? riotId : 'Not connected'}
              </p>
            </div>
          </div>
          <div className={styles.stats}>
            {stats.map((stat) => (
              <div key={stat.k}>
                <div className={styles.statValue} style={{ color: stat.c }}>
                  {stat.v}
                </div>
                <div className={styles.statLabel}>{stat.k}</div>
              </div>
            ))}
          </div>
        </div>
        <nav className={`${styles.tabs} xfade`} aria-label="Account">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? styles.tabOn : styles.tab}
              onClick={() => goTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <ChampionPicker
        open={pickerOpen}
        title="Choose a champion face"
        champions={champions}
        portraits={portraits}
        onClose={() => setPickerOpen(false)}
        onPick={(champion) => {
          void choose(champion.slug).then(() => setNotice(`Avatar set to ${champion.name}.`));
        }}
      />

      <div className={styles.body}>
        {notice ? (
          <div className={styles.notice} role="status">
            <span className={styles.noticeDot} />
            <span className={styles.noticeText}>{notice}</span>
            <button
              type="button"
              className={styles.noticeClose}
              onClick={() => setNotice('')}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ) : null}

        {tab === 'overview' ? (
          <Overview
            portraits={portraits}
            champions={champions}
            placements={placements}
            riotConnected={riotConnected}
            riotId={riotId}
            riotDraft={riotDraft}
            pool={pool}
            roleOrder={profile.preferredRoles}
            onMoveRole={moveRole}
            onDropRole={dropRole}
            onRiotDraft={setRiotDraft}
            onDisconnect={() =>
              void persistProfile(
                { riot_id: null },
                { ...profile, riotId: null },
                'Riot ID disconnected.',
              )
            }
            onConnect={() => {
              const next = riotDraft.trim();
              if (!next.includes('#')) {
                setNotice('Use Summoner#TAG.');
                return;
              }
              void persistProfile(
                { riot_id: next },
                { ...profile, riotId: next },
                'Riot ID saved.',
              );
            }}
          />
        ) : null}

        {tab === 'pool' ? (
          <Pool
            portraits={portraits}
            cards={poolCards}
            lane={poolLane}
            sort={poolSort}
            query={poolQ}
            empty={poolCards.length === 0}
            blurb={`${pool.length} champions in your pool. Their matchups come first everywhere in the app.`}
            hint={poolSortHint(poolSort, poolScopeLabel(poolLane), riotConnected)}
            results={poolResults}
            resultsLabel={
              poolQ.trim()
                ? `Champions matching "${poolQ.trim()}"`
                : poolLane === 'All'
                  ? 'Highest win rate, not in your pool yet'
                  : `Highest win rate in ${poolLane}, not in your pool yet`
            }
            noResultsText={
              poolQ.trim()
                ? `No champion outside your pool matches "${poolQ.trim()}".`
                : 'Every champion in this lane is already in your pool.'
            }
            commitLabel={
              poolLane === 'All' ? 'Save as my pool order' : `Save order for ${poolLane}`
            }
            onLane={setPoolLane}
            onSort={setPoolSort}
            onQuery={setPoolQ}
            onClearQuery={() => setPoolQ('')}
            onCommit={commitPoolOrder}
            onMove={movePool}
            onDrop={dropPool}
            onOpen={(slug) => router.push(`/champions/${slug}`)}
            onRemove={(slug) => void removePool(nameFor(slug, champions))}
            onAdd={(name) => void addPool(name)}
            adding={adding}
          />
        ) : null}

        {tab === 'saved' ? (
          <Saved
            portraits={portraits}
            saved={savedPairs}
            onOpen={(pair) =>
              router.push(`/matchups?you=${pair.youSlug}&them=${pair.themSlug}&lane=${pair.lane}`)
            }
            onRemove={(pair) => void removeSaved(pair)}
          />
        ) : null}

        {tab === 'notifications' ? (
          <Notifications
            notifs={{
              pool: profile.notifyPool,
              tier: profile.notifyTier,
              counters: profile.notifyCounters,
              digest: profile.notifyDigest,
            }}
            channel={profile.channel}
            onToggle={(key) => {
              const map = {
                pool: 'notify_pool',
                tier: 'notify_tier',
                counters: 'notify_counters',
                digest: 'notify_digest',
              } as const;
              const local = {
                pool: 'notifyPool',
                tier: 'notifyTier',
                counters: 'notifyCounters',
                digest: 'notifyDigest',
              } as const;
              const field = map[key as keyof typeof map];
              const localKey = local[key as keyof typeof local];
              if (!field || !localKey) return;
              const nextValue = !profile[localKey];
              void persistProfile(
                { [field]: nextValue },
                { ...profile, [localKey]: nextValue },
                'Notification saved.',
              );
            }}
            onChannel={(channel) =>
              void persistProfile(
                { notify_channel: channel },
                { ...profile, channel },
                'Delivery saved.',
              )
            }
          />
        ) : null}

        {tab === 'plan' ? (
          <UpgradePlans
            embedded
            waitlisted={profile.proWaitlisted}
            onJoinWaitlist={() => {
              if (profile.proWaitlisted) return;
              void persistProfile(
                { pro_waitlisted_at: new Date().toISOString() },
                { ...profile, proWaitlisted: true },
                'You are on the waitlist.',
              );
            }}
          />
        ) : null}

        {tab === 'settings' ? (
          <Settings
            email={email}
            emailEdit={emailEdit}
            emailDraft={emailDraft}
            region={profile.region}
            deleteConfirm={deleteConfirm}
            onEmailDraft={setEmailDraft}
            onToggleEmail={() => {
              if (!emailEdit) {
                setEmailDraft(email);
                setEmailEdit(true);
                return;
              }
              const next = emailDraft.trim();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(next)) {
                setNotice('That does not look like an email address.');
                return;
              }
              void (async () => {
                if (user && isSupabaseConfigured()) {
                  const { error } = await createClient().auth.updateUser({ email: next });
                  if (error) {
                    setNotice(error.message);
                    return;
                  }
                }
                setEmailEdit(false);
                setNotice('Email updated. Check the new address to confirm it.');
              })();
            }}
            onChangePass={() => router.push('/login?mode=forgot')}
            onRegion={(region) =>
              void persistProfile({ region }, { ...profile, region }, 'Region saved.')
            }
            onSignOut={() => void signOut()}
            onAskDelete={() => setDeleteConfirm(true)}
            onCancelDelete={() => setDeleteConfirm(false)}
            onConfirmDelete={() => {
              void (async () => {
                const res = await fetch('/api/account/delete', { method: 'POST' });
                if (!res.ok) {
                  const body = (await res.json().catch(() => ({}))) as { error?: string };
                  setNotice(body.error ?? 'Account deletion failed.');
                  return;
                }
                router.push('/');
                router.refresh();
              })();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function Overview({
  portraits,
  champions,
  placements,
  riotConnected,
  riotId,
  riotDraft,
  pool,
  roleOrder,
  onMoveRole,
  onDropRole,
  onRiotDraft,
  onDisconnect,
  onConnect,
}: {
  portraits: Record<string, string>;
  champions: ApiChampion[];
  placements: TierPlacementDto[];
  riotConnected: boolean;
  riotId: string;
  riotDraft: string;
  pool: string[];
  roleOrder: TierLane[];
  onMoveRole: (role: TierLane, dir: -1 | 1) => void;
  onDropRole: (from: TierLane, to: TierLane) => void;
  onRiotDraft: (value: string) => void;
  onDisconnect: () => void;
  onConnect: () => void;
}) {
  const played = pool.slice(0, 3).map((slug) => {
    const name = nameFor(slug, champions);
    const place = bestPlacement(placementsForSlug(placements, slug), roleOrder);
    return {
      name,
      slug,
      lane: place?.lane ?? roleLabel(champFor(name, champions)?.roles ?? []),
      wr: place ? formatRate(place.winRate) : '—',
      wrc: place ? (place.winRate >= 52 ? '#8FEDB8' : '#F0A87B') : '#8B87A8',
    };
  });

  return (
    <div>
    <div className={styles.split}>
      <section className={styles.card}>
        <div className={styles.cardK}>RIOT ID</div>
        {riotConnected ? (
          <>
            <div className={styles.riotRow}>
              <div className={styles.riotMark} aria-hidden>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#7FDCFF"
                  strokeWidth="2"
                >
                  <path d="M4 6l3.5 12h9L20 6l-4.5 4L12 5 8.5 10z" />
                </svg>
              </div>
              <div className={styles.riotCopy}>
                <div className={styles.riotId}>{riotId}</div>
                <div className={styles.muted}>
                  Saved on your account. Match history comes later.
                </div>
              </div>
              <div className={styles.riotActions}>
                <button type="button" className={styles.dangerGhost} onClick={onDisconnect}>
                  Disconnect
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className={styles.connectCopy}>
              No Riot ID connected. Counters stay on global data until you add one.
            </p>
            <div className={styles.connectRow}>
              <input
                className={styles.input}
                value={riotDraft}
                onChange={(e) => onRiotDraft(e.target.value)}
                placeholder="Summoner#NA1"
              />
              <button type="button" className={styles.primary} onClick={onConnect}>
                Connect
              </button>
            </div>
            {process.env.NEXT_PUBLIC_RIOT_CLIENT_ID ? (
              <p className={styles.connectCopy}>
                <a href="/auth/riot">Or verify with Riot Sign-On</a>
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardK}>YOUR POOL</div>
        <div className={styles.played}>
          {played.length ? (
            played.map((c) => (
              <Link key={c.name} href={`/champions/${c.slug}`} className={styles.playedRow}>
                <ChampFace name={c.name} slug={c.slug} size={40} portraits={portraits} />
                <div className={styles.playedCopy}>
                  <div className={styles.playedName}>{c.name}</div>
                  <div className={styles.playedMeta}>{c.lane}</div>
                </div>
                <div className={styles.playedWr} style={{ color: c.wrc }}>
                  {c.wr}
                </div>
              </Link>
            ))
          ) : (
            <p className={styles.connectCopy}>
              Add champions on the pool tab and they show up here.
            </p>
          )}
        </div>
      </section>
    </div>
    <PreferredRoles
      roles={roleOrder}
      pool={pool}
      placements={placements}
      onMove={onMoveRole}
      onDrop={onDropRole}
    />
    </div>
  );
}

function PreferredRoles({
  roles,
  pool,
  placements,
  onMove,
  onDrop,
}: {
  roles: TierLane[];
  pool: string[];
  placements: TierPlacementDto[];
  onMove: (role: TierLane, dir: -1 | 1) => void;
  onDrop: (from: TierLane, to: TierLane) => void;
}) {
  const { drag, over, rowProps } = useRankDrag<TierLane>(true, onDrop);
  const primary = roles[0] ?? 'Top';
  return (
    <section className={`${styles.card} ${styles.rolesCard}`}>
      <div className={styles.cardK}>PREFERRED ROLES</div>
      <p className={styles.roleNote}>
        Best to worst — drag a row to reorder. When a champion plays more than one lane, Forge
        reads this order to decide which matchups to load first — {primary} wins ties.
      </p>
      <div className={styles.rankList}>
        {roles.map((role, index) => {
          const count = pool.filter((slug) => playsLane(placements, slug, role)).length;
          const tag = roleRankTag(index);
          const accent = index === 0;
          return (
            <div
              key={role}
              className={styles.rankRowItem}
              style={{
                background: accent ? 'rgba(22,192,255,.05)' : undefined,
                opacity: drag === role ? 0.4 : 1,
                boxShadow: dropLine(roles, drag, over, role),
                borderBottom:
                  index < roles.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none',
              }}
              {...rowProps(role)}
            >
              <div className={styles.rankHandle}>
                <DragHandle />
                <span className={styles.rankNum} style={{ color: accent ? '#7FDCFF' : '#7B769B' }}>
                  {index + 1}
                </span>
              </div>
              <span className={styles.roleGlyph} style={{ color: accent ? '#7FDCFF' : '#7B769B' }}>
                <LaneGlyph lane={role} size={20} />
              </span>
              <div className={styles.rankCopy}>
                <div className={styles.rankName}>{role}</div>
                <div className={styles.rankMeta}>{roleCountLabel(count)}</div>
              </div>
              <div
                className={styles.roleTag}
                style={{
                  color: accent ? '#7FDCFF' : index === 1 ? '#A9A5C4' : '#6E6A8C',
                  background: accent ? 'rgba(22,192,255,.12)' : 'rgba(255,255,255,.05)',
                  borderColor: accent ? 'rgba(22,192,255,.34)' : 'rgba(255,255,255,.09)',
                }}
              >
                {tag}
              </div>
              <div className={styles.poolMove}>
                  <button
                    type="button"
                    className={styles.moveBtn}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => onMove(role, -1)}
                    disabled={index === 0}
                  aria-label={`Move ${role} up`}
                  title="Move up"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M6 14l6-6 6 6" />
                  </svg>
                </button>
                  <button
                    type="button"
                    className={styles.moveBtn}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => onMove(role, 1)}
                    disabled={index === roles.length - 1}
                  aria-label={`Move ${role} down`}
                  title="Move down"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M6 10l6 6 6-6" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Pool({
  portraits,
  cards,
  lane,
  sort,
  query,
  empty,
  blurb,
  hint,
  results,
  resultsLabel,
  noResultsText,
  commitLabel,
  onLane,
  onSort,
  onQuery,
  onClearQuery,
  onCommit,
  onMove,
  onDrop,
  onOpen,
  onRemove,
  onAdd,
  adding,
}: {
  portraits: Record<string, string>;
  cards: Array<{
    slug: string;
    name: string;
    role: string;
    wr: string;
    wrc: string;
    games: string;
  }>;
  lane: (typeof LANES)[number];
  sort: PoolSort;
  query: string;
  empty: boolean;
  blurb: string;
  hint: string;
  results: Array<{ slug: string; name: string; role: string; wr: string; wrc: string }>;
  resultsLabel: string;
  noResultsText: string;
  commitLabel: string;
  onLane: (lane: (typeof LANES)[number]) => void;
  onSort: (sort: PoolSort) => void;
  onQuery: (value: string) => void;
  onClearQuery: () => void;
  onCommit: () => void;
  onMove: (slug: string, dir: -1 | 1) => void;
  onDrop: (from: string, to: string) => void;
  onOpen: (slug: string) => void;
  onRemove: (slug: string) => void;
  onAdd: (name: string) => void;
  adding: string | null;
}) {
  const manual = sort === 'Custom';
  const { drag, over, rowProps } = useRankDrag(manual, onDrop);
  return (
    <div>
      <div className={styles.poolHead}>
        <h2 className={styles.h2}>Your champion pool</h2>
        <p className={styles.sub}>{blurb}</p>
      </div>

      <div className={styles.poolTools}>
        <div className={`${styles.pills} xfade`} role="group" aria-label="Lane">
          {LANES.map((item) => (
            <button
              key={item}
              type="button"
              className={lane === item ? styles.pillOn : styles.pill}
              onClick={() => onLane(item)}
            >
              <LaneGlyph lane={item} />
              {item}
            </button>
          ))}
        </div>
        <div className={styles.rankRow}>
          <div className={styles.rankK}>RANK BY</div>
          <div className={styles.pills} role="group" aria-label="Rank by">
            {POOL_SORTS.map((item) => (
              <button
                key={item}
                type="button"
                className={sort === item ? styles.sortOn : styles.sort}
                onClick={() => onSort(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {manual ? null : (
            <button type="button" className={styles.commit} onClick={onCommit}>
              {commitLabel}
            </button>
          )}
        </div>
      </div>

      <div className={styles.hint}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7FDCFF"
          strokeWidth="2.2"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.4M12 7.9v.1" />
        </svg>
        <p>{hint}</p>
      </div>

      {empty ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Nothing in this lane yet</div>
          <p className={styles.emptyCopy}>
            Add a champion below and their matchups move to the top of your feed.
          </p>
        </div>
      ) : (
        <div className={styles.rankList}>
          <div className={styles.rankHead}>
            <div className={styles.rankHandle}>
              <span className={styles.rankHeadK}>#</span>
            </div>
            <div className={styles.poolFaceSlot} />
            <div className={styles.rankCopy}>
              <span className={styles.rankHeadK}>CHAMPION</span>
            </div>
            <div className={styles.poolCell}>
              <span className={styles.rankHeadK}>WIN RATE</span>
            </div>
            <div className={manual ? styles.poolActionsWide : styles.poolActionsSlim} />
          </div>
          {cards.map((card, index) => (
            <div
              key={card.slug}
              className={styles.rankRowItem}
              style={{
                background: index === 0 ? 'rgba(22,192,255,.05)' : undefined,
                opacity: drag === card.slug ? 0.4 : 1,
                boxShadow: dropLine(
                  cards.map((item) => item.slug),
                  drag,
                  over,
                  card.slug,
                ),
                borderBottom:
                  index < cards.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none',
                cursor: manual ? 'grab' : 'default',
              }}
              {...rowProps(card.slug)}
            >
              <div className={styles.rankHandle}>
                <span className={manual ? undefined : styles.handleHidden}>
                  <DragHandle />
                </span>
                <span
                  className={styles.rankNum}
                  style={{ color: index === 0 ? '#7FDCFF' : '#7B769B' }}
                >
                  {index + 1}
                </span>
              </div>
              <button type="button" className={styles.poolFace} onClick={() => onOpen(card.slug)}>
                <ChampFace name={card.name} slug={card.slug} size={44} portraits={portraits} />
              </button>
              <button type="button" className={styles.rankCopy} onClick={() => onOpen(card.slug)}>
                <span className={styles.rankName}>{card.name}</span>
                <span className={styles.rankMeta}>{card.role}</span>
              </button>
              <div className={styles.poolCell}>
                <div className={styles.poolWr} style={{ color: card.wrc }}>
                  {card.wr}
                </div>
                <div className={styles.poolGames}>{card.games}</div>
              </div>
              {manual ? (
                <div className={styles.poolMove}>
                  <button
                    type="button"
                    className={styles.moveBtn}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => onMove(card.slug, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${card.name} up`}
                    title="Move up"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M6 14l6-6 6 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={styles.moveBtn}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => onMove(card.slug, 1)}
                    disabled={index === cards.length - 1}
                    aria-label={`Move ${card.name} down`}
                    title="Move down"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M6 10l6 6 6-6" />
                    </svg>
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                className={styles.poolX}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => onRemove(card.slug)}
                aria-label={`Remove ${card.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.addK}>ADD TO YOUR POOL</div>
      <div className={styles.poolSearch}>
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7FDCFF"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search any champion"
        />
        {query ? (
          <button type="button" className={styles.searchClear} onClick={onClearQuery} aria-label="Clear">
            ×
          </button>
        ) : null}
      </div>
      <div className={styles.resultsLabel}>{resultsLabel}</div>
      <div className={styles.results}>
        {results.map((row) => (
          <button
            key={row.slug}
            type="button"
            className={styles.resultRow}
            onClick={() => onAdd(row.name)}
            disabled={adding !== null}
          >
            <ChampFace name={row.name} slug={row.slug} size={38} portraits={portraits} />
            <span className={styles.resultCopy}>
              <span className={styles.resultName}>{row.name}</span>
              <span className={styles.resultRole}>{row.role}</span>
            </span>
            <span className={styles.resultWr} style={{ color: row.wrc }}>
              {row.wr}
            </span>
            <span className={styles.resultAdd}>
              {adding === row.slug ? <PendingLabel>Adding</PendingLabel> : 'Add'}
            </span>
          </button>
        ))}
        {results.length === 0 ? <p className={styles.noResults}>{noResultsText}</p> : null}
      </div>
    </div>
  );
}

function Saved({
  portraits,
  saved,
  onOpen,
  onRemove,
}: {
  portraits: Record<string, string>;
  saved: SavedPair[];
  onOpen: (pair: SavedPair) => void;
  onRemove: (pair: SavedPair) => void;
}) {
  return (
    <div>
      <h2 className={styles.h2}>Saved matchups</h2>
      <p className={styles.sub}>{saved.length ? 'Open one and the plan is already there.' : ''}</p>
      {saved.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Nothing saved yet</div>
          <p className={styles.emptyCopy}>
            Open a matchup and save it to keep the game plan one tap away in champion select.
          </p>
          <Link href="/matchups" className={styles.emptyCta}>
            Browse matchups
          </Link>
        </div>
      ) : (
        <div className={styles.savedList}>
          {saved.map((pair) => {
            const tone = sideTone(pair.side);
            return (
              <div
                key={`${pair.youSlug}-${pair.themSlug}-${pair.lane}`}
                className={styles.savedRow}
              >
                <div className={styles.savedFaces}>
                  <ChampFace name={pair.you} slug={pair.youSlug} size={44} portraits={portraits} />
                  <span className={styles.savedThem}>
                    <ChampFace
                      name={pair.them}
                      slug={pair.themSlug}
                      size={44}
                      portraits={portraits}
                    />
                  </span>
                </div>
                <div className={styles.savedCopy}>
                  <div className={styles.savedTitle}>
                    {pair.you} vs {pair.them}
                  </div>
                  <div className={styles.savedMeta}>{pair.lane} lane</div>
                </div>
                <div
                  className={styles.savedChip}
                  style={{ color: tone.c, background: tone.bg, borderColor: tone.bd }}
                >
                  <span style={{ background: tone.c }} />
                  {pair.verdict}
                </div>
                <div className={styles.savedActions}>
                  <button type="button" className={styles.openBtn} onClick={() => onOpen(pair)}>
                    Open
                  </button>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => onRemove(pair)}
                    aria-label={`Remove ${pair.you} vs ${pair.them}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Notifications({
  notifs,
  channel,
  onToggle,
  onChannel,
}: {
  notifs: Record<string, boolean>;
  channel: AccountChannel;
  onToggle: (key: string) => void;
  onChannel: (channel: AccountChannel) => void;
}) {
  return (
    <div className={styles.narrow}>
      <h2 className={styles.h2}>Notifications</h2>
      <p className={styles.sub}>Only about the champions and lanes in your pool.</p>
      <div className={styles.toggleCard}>
        {NOTIFS.map((row) => {
          const on = !!notifs[row.k];
          return (
            <button
              key={row.k}
              type="button"
              className={styles.toggleRow}
              onClick={() => onToggle(row.k)}
              aria-pressed={on}
            >
              <span>
                <span className={styles.toggleName}>{row.name}</span>
                <span className={styles.toggleNote}>{row.note}</span>
              </span>
              <span className={on ? styles.switchOn : styles.switch} aria-hidden>
                <span />
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.addK}>SEND THEM BY</div>
      <div className={styles.pills}>
        {ACCOUNT_CHANNELS.map((item) => (
          <button
            key={item}
            type="button"
            className={channel === item ? styles.pillOn : styles.pill}
            onClick={() => onChannel(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function Settings({
  email,
  emailEdit,
  emailDraft,
  region,
  deleteConfirm,
  onEmailDraft,
  onToggleEmail,
  onChangePass,
  onRegion,
  onSignOut,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  email: string;
  emailEdit: boolean;
  emailDraft: string;
  region: AccountRegion;
  deleteConfirm: boolean;
  onEmailDraft: (value: string) => void;
  onToggleEmail: () => void;
  onChangePass: () => void;
  onRegion: (region: AccountRegion) => void;
  onSignOut: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  return (
    <div className={styles.narrow}>
      <h2 className={styles.h2}>Account</h2>
      <div className={styles.toggleCard}>
        <div className={styles.settingRow}>
          <div className={styles.settingCopy}>
            <div className={styles.settingK}>EMAIL</div>
            {emailEdit ? (
              <input
                className={styles.input}
                value={emailDraft}
                onChange={(e) => onEmailDraft(e.target.value)}
              />
            ) : (
              <div className={styles.settingV}>{email}</div>
            )}
          </div>
          <button type="button" className={styles.ghost} onClick={onToggleEmail}>
            {emailEdit ? 'Save' : 'Change'}
          </button>
        </div>
        <div className={styles.settingRow}>
          <div className={styles.settingCopy}>
            <div className={styles.settingK}>PASSWORD</div>
            <div className={styles.settingV}>Use the reset link to set a new one</div>
          </div>
          <button type="button" className={styles.ghost} onClick={onChangePass}>
            Change password
          </button>
        </div>
        <div className={styles.settingBlock}>
          <div className={styles.settingK}>REGION</div>
          <div className={styles.regionRow}>
            {ACCOUNT_REGIONS.map((item) => (
              <button
                key={item}
                type="button"
                className={region === item ? styles.regionOn : styles.region}
                onClick={() => onRegion(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.dangerRow}>
        <button type="button" className={styles.ghost} onClick={onSignOut}>
          Sign out
        </button>
        {deleteConfirm ? null : (
          <button type="button" className={styles.dangerGhost} onClick={onAskDelete}>
            Delete account
          </button>
        )}
      </div>
      {deleteConfirm ? (
        <div className={styles.deleteBox}>
          <div className={styles.deleteTitle}>Delete this account?</div>
          <p className={styles.deleteCopy}>
            Your champion pool, saved matchups and connected Riot ID go with it. This cannot be
            undone.
          </p>
          <div className={styles.deleteActions}>
            <button type="button" className={styles.deleteYes} onClick={onConfirmDelete}>
              Yes, delete it
            </button>
            <button type="button" className={styles.ghost} onClick={onCancelDelete}>
              Keep my account
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
