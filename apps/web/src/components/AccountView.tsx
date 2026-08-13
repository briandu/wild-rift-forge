'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useChampionAvatar } from '@/hooks/useChampionAvatar';
import type { ApiChampion } from '@/lib/api';
import {
  ACCOUNT_CHANNELS,
  ACCOUNT_REGIONS,
  loadAccountState,
  patchProfile,
  type AccountChannel,
  type AccountProfile,
  type AccountRegion,
  type SavedMatchupRow,
} from '@/lib/account';
import { portraitsFromRoster } from '@/lib/champions';
import { CHAMP_META, metaFor } from '@/lib/design-stubs';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { ChampFace } from './ChampFace';
import { ChampionPicker } from './ChampionPicker';
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
  { k: 'pool', name: 'Patch changes to my pool', note: 'When a champion you play, or a common opponent, is buffed or nerfed.' },
  { k: 'tier', name: 'Tier shifts in my lanes', note: 'Only when something moves a full tier, not every decimal.' },
  { k: 'counters', name: 'New counters worth learning', note: 'When a pick starts beating a champion you struggle against.' },
  { k: 'digest', name: 'Weekly digest', note: 'One summary on Monday instead of alerts through the week.' },
] as const;
const PLAN_INCLUDED = [
  'Every matchup, counter and tier list',
  'Draft suggestions weighted to your pool',
  'Unlimited saved matchups',
  'Patch alerts for your champions',
];
const PLAN_PRO = [
  'Champion select overlay that reads the lobby',
  'Your own match history as the data source',
  'Shared plans for a full team',
];

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

function toSavedPair(row: SavedMatchupRow, champions: ApiChampion[]): SavedPair {
  const you = nameFor(row.youSlug, champions);
  const them = nameFor(row.themSlug, champions);
  const youWr = parseFloat(metaFor(you).wr);
  const themWr = parseFloat(metaFor(them).wr);
  const side: SavedPair['side'] = youWr - themWr >= 1.5 ? 'you' : themWr - youWr >= 1.5 ? 'them' : 'even';
  const verdict =
    side === 'you' ? `${you.toUpperCase()} FAVOURED` : side === 'them' ? `${them.toUpperCase()} FAVOURED` : 'EVEN MATCHUP';
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
};

export function AccountView({ champions = [] }: { champions?: ApiChampion[] }) {
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
  const [emailEdit, setEmailEdit] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const displayName = profile.riotId || user?.email || 'Account';
  const savedPairs = useMemo(() => saved.map((row) => toSavedPair(row, champions)), [saved, champions]);
  const poolNames = useMemo(() => pool.map((slug) => nameFor(slug, champions)), [pool, champions]);

  const visiblePool = useMemo(
    () =>
      poolNames.filter((name) => poolLane === 'All' || metaFor(name).lanes.includes(poolLane)),
    [pool, poolLane, poolNames],
  );

  const suggestions = useMemo(
    () =>
      champions
        .map((champion) => champion.name)
        .concat(Object.keys(CHAMP_META))
        .filter((name, i, all) => all.indexOf(name) === i)
        .filter((name) => !poolNames.includes(name))
        .filter((name) => poolLane === 'All' || metaFor(name).lanes.includes(poolLane))
        .slice(0, 8),
    [champions, poolLane, poolNames],
  );

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

  async function addPool(name: string) {
    const slug = champions.find((champion) => champion.name === name)?.slug ?? metaFor(name).slug;
    setPool((cur) => (cur.includes(slug) ? cur : [...cur, slug]));
    setNotice(`${name} added to your pool.`);
    if (user && isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.rpc('ensure_default_avatar');
      const { error } = await supabase
        .from('user_champion_pool')
        .insert({ user_id: user.id, champion_slug: slug });
      if (error && !error.message.includes('duplicate')) {
        setNotice(error.message);
      }
    }
  }

  async function removePool(name: string) {
    const slug = champions.find((champion) => champion.name === name)?.slug ?? metaFor(name).slug;
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
      cur.filter((row) => !(row.youSlug === pair.youSlug && row.themSlug === pair.themSlug && row.lane === pair.lane)),
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
              <h1 className={styles.name}>{displayName}</h1>
              <p className={styles.meta}>
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
        <nav className={styles.tabs} aria-label="Account">
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
            <button type="button" className={styles.noticeClose} onClick={() => setNotice('')} aria-label="Dismiss">
              ×
            </button>
          </div>
        ) : null}

        {tab === 'overview' ? (
          <Overview
            portraits={portraits}
            riotConnected={riotConnected}
            riotId={riotId}
            riotDraft={riotDraft}
            pool={poolNames}
            onRiotDraft={setRiotDraft}
            onDisconnect={() =>
              void persistProfile({ riot_id: null }, { ...profile, riotId: null }, 'Riot ID disconnected.')
            }
            onConnect={() => {
              const next = riotDraft.trim();
              if (!next.includes('#')) {
                setNotice('Use Summoner#TAG.');
                return;
              }
              void persistProfile({ riot_id: next }, { ...profile, riotId: next }, 'Riot ID saved.');
            }}
          />
        ) : null}

        {tab === 'pool' ? (
          <Pool
            portraits={portraits}
            pool={visiblePool}
            lane={poolLane}
            empty={visiblePool.length === 0}
            blurb={`${pool.length} champions in your pool. Their matchups come first everywhere in the app.`}
            suggestions={suggestions}
            onLane={setPoolLane}
            onOpen={(name) => router.push(`/champions/${metaFor(name).slug}`)}
            onRemove={(name) => void removePool(name)}
            onAdd={(name) => void addPool(name)}
          />
        ) : null}

        {tab === 'saved' ? (
          <Saved
            portraits={portraits}
            saved={savedPairs}
            onOpen={(pair) => router.push(`/matchups?you=${pair.youSlug}&them=${pair.themSlug}&lane=${pair.lane}`)}
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
              void persistProfile({ [field]: nextValue }, { ...profile, [localKey]: nextValue }, 'Notification saved.');
            }}
            onChannel={(channel) =>
              void persistProfile({ notify_channel: channel }, { ...profile, channel }, 'Delivery saved.')
            }
          />
        ) : null}

        {tab === 'plan' ? (
          <Plan
            waitlist={profile.proWaitlisted}
            onWaitlist={() => {
              const next = !profile.proWaitlisted;
              void persistProfile(
                { pro_waitlisted_at: next ? new Date().toISOString() : null },
                { ...profile, proWaitlisted: next },
                next ? 'You are on the waitlist.' : 'Removed from the waitlist.',
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
            onRegion={(region) => void persistProfile({ region }, { ...profile, region }, 'Region saved.')}
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
  riotConnected,
  riotId,
  riotDraft,
  pool,
  onRiotDraft,
  onDisconnect,
  onConnect,
}: {
  portraits: Record<string, string>;
  riotConnected: boolean;
  riotId: string;
  riotDraft: string;
  pool: string[];
  onRiotDraft: (value: string) => void;
  onDisconnect: () => void;
  onConnect: () => void;
}) {
  const played = pool.slice(0, 3).map((name) => {
    const meta = metaFor(name);
    return {
      name,
      slug: meta.slug,
      lane: meta.lanes[0] ?? 'Top',
      wr: meta.wr,
      wrc: parseFloat(meta.wr) >= 52 ? '#8FEDB8' : '#F0A87B',
    };
  });

  return (
    <div className={styles.split}>
      <section className={styles.card}>
        <div className={styles.cardK}>RIOT ID</div>
        {riotConnected ? (
          <>
            <div className={styles.riotRow}>
              <div className={styles.riotMark} aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7FDCFF" strokeWidth="2">
                  <path d="M4 6l3.5 12h9L20 6l-4.5 4L12 5 8.5 10z" />
                </svg>
              </div>
              <div className={styles.riotCopy}>
                <div className={styles.riotId}>{riotId}</div>
                <div className={styles.muted}>Saved on your account. Match history comes later.</div>
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
                <ChampFace name={c.name} size={40} portraits={portraits} />
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
            <p className={styles.connectCopy}>Add champions on the pool tab and they show up here.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Pool({
  portraits,
  pool,
  lane,
  empty,
  blurb,
  suggestions,
  onLane,
  onOpen,
  onRemove,
  onAdd,
}: {
  portraits: Record<string, string>;
  pool: string[];
  lane: (typeof LANES)[number];
  empty: boolean;
  blurb: string;
  suggestions: string[];
  onLane: (lane: (typeof LANES)[number]) => void;
  onOpen: (name: string) => void;
  onRemove: (name: string) => void;
  onAdd: (name: string) => void;
}) {
  return (
    <div>
      <div className={styles.poolHead}>
        <div>
          <h2 className={styles.h2}>Your champion pool</h2>
          <p className={styles.sub}>{blurb}</p>
        </div>
        <div className={styles.pills} role="group" aria-label="Lane">
          {LANES.map((item) => (
            <button
              key={item}
              type="button"
              className={lane === item ? styles.pillOn : styles.pill}
              onClick={() => onLane(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Nothing in this lane yet</div>
          <p className={styles.emptyCopy}>Add a champion below and their matchups move to the top of your feed.</p>
        </div>
      ) : (
        <div className={styles.poolGrid}>
          {pool.map((name) => (
            <div key={name} className={styles.poolCard}>
              <button type="button" className={styles.poolX} onClick={() => onRemove(name)} aria-label={`Remove ${name}`}>
                ×
              </button>
              <button type="button" className={styles.poolFace} onClick={() => onOpen(name)}>
                <ChampFace name={name} size={62} portraits={portraits} />
              </button>
              <div className={styles.poolName}>{name}</div>
              <div className={styles.poolRole}>{metaFor(name).role}</div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.addK}>ADD TO YOUR POOL</div>
      <div className={styles.suggest}>
        {suggestions.map((name) => (
          <button key={name} type="button" className={styles.suggestChip} onClick={() => onAdd(name)}>
            <ChampFace name={name} size={30} portraits={portraits} />
            <span>{name}</span>
            <span className={styles.suggestPlus}>+</span>
          </button>
        ))}
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
              <div key={`${pair.youSlug}-${pair.themSlug}-${pair.lane}`} className={styles.savedRow}>
                <div className={styles.savedFaces}>
                  <ChampFace name={pair.you} size={44} portraits={portraits} />
                  <span className={styles.savedThem}>
                    <ChampFace name={pair.them} size={44} portraits={portraits} />
                  </span>
                </div>
                <div className={styles.savedCopy}>
                  <div className={styles.savedTitle}>
                    {pair.you} vs {pair.them}
                  </div>
                  <div className={styles.savedMeta}>{pair.lane} lane</div>
                </div>
                <div className={styles.savedChip} style={{ color: tone.c, background: tone.bg, borderColor: tone.bd }}>
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
            <button key={row.k} type="button" className={styles.toggleRow} onClick={() => onToggle(row.k)} aria-pressed={on}>
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

function Plan({ waitlist, onWaitlist }: { waitlist: boolean; onWaitlist: () => void }) {
  return (
    <div className={styles.planGrid}>
      <section className={styles.planNow}>
        <div className={styles.planKicker}>
          <span className={styles.cardK}>CURRENT PLAN</span>
          <span className={styles.active}>ACTIVE</span>
        </div>
        <div className={styles.planName}>Beta · Free</div>
        <p className={styles.planCopy}>Everything is open while we are in beta. No card, no trial clock.</p>
        <ul className={styles.planList}>
          {PLAN_INCLUDED.map((item) => (
            <li key={item}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8FEDB8" strokeWidth="3" aria-hidden>
                <path d="M4 12.5l5.2 5.2L20 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.card}>
        <div className={styles.laterK}>LATER</div>
        <div className={styles.planName}>Forge Pro</div>
        <p className={styles.planMuted}>
          Live champion select overlay, your own match history as the data source, and unlimited saved plans.
        </p>
        <ul className={styles.planLater}>
          {PLAN_PRO.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <button type="button" className={waitlist ? styles.waitOn : styles.wait} onClick={onWaitlist}>
          {waitlist ? 'You are on the waitlist' : 'Join the Pro waitlist'}
        </button>
        <p className={styles.waitNote}>Beta accounts keep free access for a season after Pro launches.</p>
      </section>
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
              <input className={styles.input} value={emailDraft} onChange={(e) => onEmailDraft(e.target.value)} />
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
            Your champion pool, saved matchups and connected Riot ID go with it. This cannot be undone.
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
