'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { ApiChampion } from '@/lib/api';
import { portraitsFromRoster } from '@/lib/champions';
import { ACCOUNT_STUB, CHAMP_META, metaFor } from '@/lib/design-stubs';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { ChampFace } from './ChampFace';
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
type SavedPair = (typeof ACCOUNT_STUB.saved)[number];

const LANES = ['All', 'Top', 'Jungle', 'Mid', 'Dragon', 'Support'] as const;
const CHANNELS = ['Email', 'Push', 'Both'] as const;
const REGIONS = ['NA', 'EUW', 'BR', 'KR', 'SEA'] as const;
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

function riotIdFor(user: User | null, connected: boolean, draft: string): string {
  if (!connected) return 'No Riot ID';
  if (draft.trim()) return draft.trim();
  const meta = user?.user_metadata as { riot_id?: string } | undefined;
  return meta?.riot_id?.trim() || ACCOUNT_STUB.riotId;
}

export function AccountView({ champions = [] }: { champions?: ApiChampion[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFrom(searchParams.get('tab'));
  const portraits = portraitsFromRoster(champions);

  const [user, setUser] = useState<User | null>(null);
  const [riotConnected, setRiotConnected] = useState(true);
  const [riotDraft, setRiotDraft] = useState('');
  const [pool, setPool] = useState<string[]>(() => [...ACCOUNT_STUB.pool]);
  const [saved, setSaved] = useState<SavedPair[]>(() => [...ACCOUNT_STUB.saved]);
  const [poolLane, setPoolLane] = useState<(typeof LANES)[number]>('All');
  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    pool: true,
    tier: true,
    counters: false,
    digest: true,
  });
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('Email');
  const [waitlist, setWaitlist] = useState(false);
  const [region, setRegion] = useState<(typeof REGIONS)[number]>('NA');
  const [emailEdit, setEmailEdit] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [refreshed, setRefreshed] = useState(false);

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

  const email = user?.email ?? 'you@example.com';
  const riotId = riotIdFor(user, riotConnected, riotDraft);
  const rankLine = riotConnected ? ACCOUNT_STUB.rankLine : 'Not connected';

  const visiblePool = useMemo(
    () => pool.filter((name) => poolLane === 'All' || metaFor(name).lanes.includes(poolLane)),
    [pool, poolLane],
  );

  const suggestions = useMemo(
    () =>
      ACCOUNT_STUB.suggestions
        .concat(Object.keys(CHAMP_META))
        .filter((name, i, all) => all.indexOf(name) === i)
        .filter((name) => !pool.includes(name))
        .filter((name) => poolLane === 'All' || metaFor(name).lanes.includes(poolLane))
        .slice(0, 8),
    [pool, poolLane],
  );

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
    router.push('/');
    router.refresh();
  }

  return (
    <div>
      <header className={styles.hero}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.heroInner}>
          <div className={styles.identity}>
            <div className={styles.avatar} aria-hidden />
            <div className={styles.identityCopy}>
              <div className={styles.kicker}>ACCOUNT</div>
              <h1 className={styles.name}>{riotId}</h1>
              <p className={styles.meta}>
                {email} · {rankLine}
              </p>
            </div>
          </div>
          <div className={styles.stats}>
            {ACCOUNT_STUB.stats.map((stat) => (
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
            refreshed={refreshed}
            pool={pool}
            onRiotDraft={setRiotDraft}
            onRefresh={() => {
              setRefreshed(true);
              setNotice('Read your last 20 ranked games.');
            }}
            onDisconnect={() => {
              setRiotConnected(false);
              setNotice('Riot ID disconnected. Rankings are global again.');
            }}
            onConnect={() => {
              setRiotConnected(true);
              setNotice('Riot ID connected.');
            }}
          />
        ) : null}

        {tab === 'pool' ? (
          <Pool
            portraits={portraits}
            pool={visiblePool}
            lane={poolLane}
            empty={visiblePool.length === 0}
            blurb={`${pool.length} champions across ${new Set(pool.flatMap((n) => metaFor(n).lanes)).size} lanes. Their matchups come first everywhere in the app.`}
            suggestions={suggestions}
            onLane={setPoolLane}
            onOpen={(name) => router.push(`/champions/${metaFor(name).slug}`)}
            onRemove={(name) => {
              setPool((cur) => cur.filter((n) => n !== name));
              setNotice(`${name} removed from your pool.`);
            }}
            onAdd={(name) => {
              setPool((cur) => [...cur, name]);
              setNotice(`${name} added to your pool.`);
            }}
          />
        ) : null}

        {tab === 'saved' ? (
          <Saved
            portraits={portraits}
            saved={saved}
            onOpen={() => router.push('/matchups')}
            onRemove={(pair) => {
              setSaved((cur) => cur.filter((p) => !(p.you === pair.you && p.them === pair.them)));
              setNotice(`${pair.you} vs ${pair.them} removed.`);
            }}
          />
        ) : null}

        {tab === 'notifications' ? (
          <Notifications
            notifs={notifs}
            channel={channel}
            onToggle={(key) => setNotifs((cur) => ({ ...cur, [key]: !cur[key] }))}
            onChannel={setChannel}
          />
        ) : null}

        {tab === 'plan' ? <Plan waitlist={waitlist} onWaitlist={() => setWaitlist((v) => !v)} /> : null}

        {tab === 'settings' ? (
          <Settings
            email={email}
            emailEdit={emailEdit}
            emailDraft={emailDraft}
            region={region}
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
              setEmailEdit(false);
              setNotice('Email updated. Check the new address to confirm it.');
            }}
            onChangePass={() => router.push('/login?mode=forgot')}
            onRegion={setRegion}
            onSignOut={() => void signOut()}
            onAskDelete={() => setDeleteConfirm(true)}
            onCancelDelete={() => setDeleteConfirm(false)}
            onConfirmDelete={() => {
              setDeleteConfirm(false);
              setNotice('Account deletion is not available yet.');
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
  refreshed,
  pool,
  onRiotDraft,
  onRefresh,
  onDisconnect,
  onConnect,
}: {
  portraits: Record<string, string>;
  riotConnected: boolean;
  riotId: string;
  riotDraft: string;
  refreshed: boolean;
  pool: string[];
  onRiotDraft: (value: string) => void;
  onRefresh: () => void;
  onDisconnect: () => void;
  onConnect: () => void;
}) {
  const played = pool.slice(0, 3).map((name, i) => {
    const preset = ACCOUNT_STUB.mostPlayed[i];
    const meta = metaFor(name);
    const wr = parseFloat(meta.wr);
    return {
      name,
      slug: meta.slug,
      games: preset?.name === name ? preset.games : 18,
      lane: preset?.name === name ? preset.lane : meta.lanes[0] ?? 'Top',
      wr: meta.wr,
      wrc: wr >= 52 ? '#8FEDB8' : '#F0A87B',
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
                <div className={styles.muted}>
                  {refreshed ? 'Match history read just now' : 'Match history read 2 hours ago'}
                </div>
              </div>
              <div className={styles.riotActions}>
                <button type="button" className={styles.ghost} onClick={onRefresh}>
                  {refreshed ? 'Up to date' : 'Refresh'}
                </button>
                <button type="button" className={styles.dangerGhost} onClick={onDisconnect}>
                  Disconnect
                </button>
              </div>
            </div>
            <div className={styles.rule} />
            <div className={styles.lpRow}>
              <div className={styles.lpRank}>{ACCOUNT_STUB.rank}</div>
              <div className={styles.muted}>{ACCOUNT_STUB.lp}</div>
            </div>
            <div className={styles.lpTrack}>
              <div className={styles.lpFill} style={{ width: `${ACCOUNT_STUB.lpBar}%` }} />
            </div>
            <div className={styles.lpNote}>{ACCOUNT_STUB.nextRank}</div>
          </>
        ) : (
          <>
            <p className={styles.connectCopy}>
              No Riot ID connected. Counters are ranked on global data until you add one.
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
          </>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardK}>MOST PLAYED THIS SEASON</div>
        <div className={styles.played}>
          {played.map((c) => (
            <Link key={c.name} href={`/champions/${c.slug}`} className={styles.playedRow}>
              <ChampFace name={c.name} size={40} portraits={portraits} />
              <div className={styles.playedCopy}>
                <div className={styles.playedName}>{c.name}</div>
                <div className={styles.playedMeta}>
                  {c.games} games · {c.lane}
                </div>
              </div>
              <div className={styles.playedWr} style={{ color: c.wrc }}>
                {c.wr}
              </div>
            </Link>
          ))}
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
  onOpen: () => void;
  onRemove: (pair: SavedPair) => void;
}) {
  return (
    <div>
      <h2 className={styles.h2}>Saved matchups</h2>
      <p className={styles.sub}>
        {saved.length ? 'Open one in champion select and the plan is already there.' : ''}
      </p>
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
              <div key={`${pair.you}-${pair.them}`} className={styles.savedRow}>
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
                  <div className={styles.savedMeta}>{pair.lane} lane · saved this patch</div>
                </div>
                <div className={styles.savedChip} style={{ color: tone.c, background: tone.bg, borderColor: tone.bd }}>
                  <span style={{ background: tone.c }} />
                  {pair.verdict}
                </div>
                <div className={styles.savedActions}>
                  <button type="button" className={styles.openBtn} onClick={onOpen}>
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
  channel: (typeof CHANNELS)[number];
  onToggle: (key: string) => void;
  onChannel: (channel: (typeof CHANNELS)[number]) => void;
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
        {CHANNELS.map((item) => (
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
        <button
          type="button"
          className={waitlist ? styles.waitOn : styles.wait}
          onClick={onWaitlist}
        >
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
  region: (typeof REGIONS)[number];
  deleteConfirm: boolean;
  onEmailDraft: (value: string) => void;
  onToggleEmail: () => void;
  onChangePass: () => void;
  onRegion: (region: (typeof REGIONS)[number]) => void;
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
            <div className={styles.settingV}>Last changed {ACCOUNT_STUB.passAge}</div>
          </div>
          <button type="button" className={styles.ghost} onClick={onChangePass}>
            Change password
          </button>
        </div>
        <div className={styles.settingBlock}>
          <div className={styles.settingK}>REGION</div>
          <div className={styles.regionRow}>
            {REGIONS.map((item) => (
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
