'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { TIER_LANES, type TierLane } from '@wild-rift-forge/game-data';
import type { ApiChampion, MatchupResponse, TierPlacementDto } from '@/lib/api';
import { resolveAbilities } from '@/lib/abilities';
import { abilitySlotLabel } from '@/lib/ability-mentions';
import { bannerFocusFor, cardFocusFor } from '@/lib/banner-focus';
import { FACE_FALLBACK_BG, initials, portraitsFromRoster, roleLabel, splashFor } from '@/lib/champions';
import {
  loadAccountState,
  type SavedMatchupRow,
} from '@/lib/account';
import {
  buildMatchupCard,
  coachBriefFor,
  type MatchupCard,
  type MatchupChip,
  type MatchupSideCard,
} from '@/lib/matchup-card';
import { commonLaneChampions, poolInLane, youLaneSuggestions } from '@/lib/matchup-suggest';
import { bestPlacement, formatRate, placementsForSlug } from '@/lib/placements';
import { preferredLaneOf } from '@/lib/roles';
import { useDelayedReveal } from '@/hooks/useDelayedReveal';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { AbilityMarkup } from './AbilityMarkup';
import { AbilityChip, AbilityRichText } from './AbilityTip';
import { ChampFace } from './ChampFace';
import { ChampionPicker } from './ChampionPicker';
import { LaneGlyph } from './LaneGlyph';
import { PendingLabel, RefreshFrame, Spinner } from './LoadState';
import styles from './MatchupView.module.css';

const MU_TABS = ['Quick', 'Plan', 'Trades', 'Build'] as const;
type MuTab = (typeof MU_TABS)[number];

function laneNice(lane: string): string {
  return lane.charAt(0) + lane.slice(1).toLowerCase();
}

function heroFocus(slug: string, side: 'you' | 'them') {
  const focus = bannerFocusFor(slug);
  return {
    x: side === 'you' ? focus.x || 46 : focus.x || 56,
    y: focus.y > 8 ? focus.y : side === 'you' ? 20 : 18,
  };
}

type MatchupProps = {
  champions?: ApiChampion[];
  matchup: MatchupResponse | null;
  youSlug: string;
  themSlug: string;
  lane: string;
  placements?: TierPlacementDto[];
  roleOrder?: TierLane[];
};

export function MatchupView(props: MatchupProps) {
  if (!props.youSlug || !props.themSlug) {
    return <MatchupSelect {...props} />;
  }
  return <MatchupLoaded {...props} />;
}

function MatchupLoaded({
  champions = [],
  matchup,
  youSlug,
  themSlug,
  lane,
  placements = [],
  roleOrder = TIER_LANES as TierLane[],
}: MatchupProps) {
  const router = useRouter();
  const mu = buildMatchupCard(matchup, youSlug, themSlug, lane, champions);
  const portraits = portraitsFromRoster(champions);
  const [open, setOpen] = useState<string | null>(null);
  const [coach, setCoach] = useState<'idle' | 'loading' | 'done'>('idle');
  const [picking, setPicking] = useState<'you' | 'them' | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<MuTab>('Quick');
  const [refreshing, startTransition] = useTransition();
  const showCoachSkel = useDelayedReveal(coach === 'loading');
  const coachTimer = useRef<number | null>(null);
  const brief = coachBriefFor(mu);
  const kits = {
    [mu.you.name]: resolveAbilities(matchup?.abilitiesYou),
    [mu.them.name]: resolveAbilities(matchup?.abilitiesThem),
  };

  function setPair(next: { you?: string | null; them?: string | null; lane?: string | null }) {
    const params = new URLSearchParams();
    const you = next.you === undefined ? youSlug : next.you;
    const them = next.them === undefined ? themSlug : next.them;
    const nextLane = next.lane === undefined ? lane : next.lane;
    if (you) params.set('you', you);
    if (them) params.set('them', them);
    if (nextLane) params.set('lane', nextLane);
    startTransition(() => {
      router.replace(params.size ? `/matchups?${params}` : '/matchups');
    });
    setSaved(false);
    if (coachTimer.current) window.clearTimeout(coachTimer.current);
    setCoach('idle');
    setTab('Quick');
  }

  function swapPair() {
    setPair({ you: themSlug, them: youSlug });
  }

  async function savePair() {
    if (saving) return;
    setSaving(true);
    try {
      if (!isSupabaseConfigured()) {
        setSaved(true);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push('/login');
        return;
      }
      await supabase.rpc('ensure_default_avatar');
      const { error } = await supabase.from('user_saved_matchups').insert({
        user_id: data.user.id,
        you_slug: youSlug,
        them_slug: themSlug,
        lane,
      });
      if (error && !error.message.toLowerCase().includes('duplicate')) {
        return;
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function runCoach() {
    if (coachTimer.current) window.clearTimeout(coachTimer.current);
    setCoach('loading');
    coachTimer.current = window.setTimeout(() => setCoach('done'), 700);
  }

  useEffect(() => () => {
    if (coachTimer.current) window.clearTimeout(coachTimer.current);
  }, []);

  const verdictC = mu.side === 'them' ? '#E58B7B' : mu.side === 'you' ? '#8FEDB8' : '#F0A87B';
  const verdictBg =
    mu.side === 'them'
      ? 'rgba(229,139,123,.12)'
      : mu.side === 'you'
        ? 'rgba(123,224,168,.12)'
        : 'rgba(240,168,123,.12)';
  const verdictBd =
    mu.side === 'them'
      ? 'rgba(229,139,123,.38)'
      : mu.side === 'you'
        ? 'rgba(123,224,168,.38)'
        : 'rgba(240,168,123,.38)';

  function toggle(key: string) {
    setOpen((cur) => (cur === key ? null : key));
  }

  const vars = {
    '--verdict-c': verdictC,
    '--verdict-bg': verdictBg,
    '--verdict-bd': verdictBd,
  } as CSSProperties;

  return (
    <RefreshFrame active={refreshing} style={vars}>
      <PosterHero you={mu.you} them={mu.them} champions={champions} mu={mu} chips={mu.quick} />
      <MobileHero you={mu.you} them={mu.them} portraits={portraits} mu={mu} chips={mu.quick} />
      <div className={styles.pickerBar}>
        <button type="button" className={styles.pairPick} onClick={() => setPicking('you')}>
          <ChampFace name={mu.you.name} slug={mu.you.slug} size={30} portraits={portraits} />
          <span className={styles.pairCopy}>
            <span className={styles.pairKYou}>YOU</span>
            <span className={styles.pairName}>{mu.you.name}</span>
          </span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7B769B" strokeWidth="2.4" aria-hidden>
            <path d="M6 9.5l6 6 6-6" />
          </svg>
        </button>
        <button type="button" className={styles.swapBtn} onClick={swapPair} aria-label="Swap champions">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BBB7D4" strokeWidth="2.2">
            <path d="M4 8h14l-3.4-3.4M20 16H6l3.4 3.4" />
          </svg>
        </button>
        <button type="button" className={styles.pairPickThem} onClick={() => setPicking('them')}>
          <ChampFace name={mu.them.name} slug={mu.them.slug} size={30} portraits={portraits} />
          <span className={styles.pairCopy}>
            <span className={styles.pairKThem}>AGAINST</span>
            <span className={styles.pairName}>{mu.them.name}</span>
          </span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7B769B" strokeWidth="2.4" aria-hidden>
            <path d="M6 9.5l6 6 6-6" />
          </svg>
        </button>
        <div className={`${styles.pickLanes} xfade`}>
          {TIER_LANES.map((item) => (
            <button
              key={item}
              type="button"
              className={lane === item ? styles.pickLaneOn : styles.pickLane}
              onClick={() => setPair({ lane: item })}
            >
              <LaneGlyph lane={item} />
              {item}
            </button>
          ))}
        </div>
        <button type="button" className={styles.clearBtn} onClick={() => setPair({ you: null, them: null, lane: null })}>
          Clear
        </button>
        <button type="button" className={styles.saveBtn} onClick={() => void savePair()} disabled={saving}>
          {saving ? (
            <PendingLabel>Saving</PendingLabel>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M7 4h10v16l-5-4-5 4z" />
              </svg>
              {saved ? 'Saved' : 'Save matchup'}
            </>
          )}
        </button>
      </div>
      <ChampionPicker
        open={picking !== null}
        title={picking === 'you' ? 'Your champion' : 'Enemy champion'}
        champions={champions}
        portraits={portraits}
        exclude={picking === 'you' ? [themSlug] : [youSlug]}
        onClose={() => setPicking(null)}
        onPick={(champion) => {
          const lanes = placementsForSlug(placements, champion.slug).map((row) => row.lane);
          const nextLane = lanes.includes(lane as TierLane)
            ? lane
            : preferredLaneOf(lanes, roleOrder) ?? lane;
          if (picking === 'you') setPair({ you: champion.slug, lane: nextLane });
          if (picking === 'them') setPair({ them: champion.slug, lane: nextLane });
        }}
      />

      <div className={styles.mobilePane}>
        <div className={styles.mobileTabBar}>
          {MU_TABS.map((item) => (
            <button
              key={item}
              type="button"
              className={tab === item ? styles.mobileTabOn : styles.mobileTab}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === 'Quick' ? (
          <div className={styles.mobileTabBody}>
            <div className={styles.styleCard}>
              <div className={styles.styleK}>RECOMMENDED LANE STYLE</div>
              <div className={styles.styleTitle}>{mu.style}</div>
              <div className={styles.styleBar}>
                <div className={styles.styleKnob} style={{ left: `${mu.stylePos}%` }} />
              </div>
              <div className={styles.styleEnds}>
                <span>DEFENSIVE</span>
                <span>ALL-IN</span>
              </div>
            </div>
            {mu.authored ? null : (
              <div className={styles.mobileModelled}>
                <div className={styles.mobileModelledK}>MODELLED READ</div>
                <p>
                  No written breakdown for this pairing yet. Everything here is modelled from match
                  data. Check back shortly — we are writing the plan now.
                </p>
                <p className={styles.mobileModelledGap}>{mu.modelled.gapLine}</p>
              </div>
            )}
            {mu.modelled.counterWhy ? (
              <div className={styles.mobileWhy}>
                <div className={styles.mobileModelledK}>{mu.modelled.counterTag}</div>
                <p>{mu.modelled.counterWhy}</p>
              </div>
            ) : null}
            {mu.modelled.notes.length > 0 ? (
              <div>
                <div className={styles.mobileKnow}>WHAT TO KNOW</div>
                {mu.modelled.notes.map((note) => (
                  <div key={note} className={styles.mobileNote}>
                    <span />
                    <p>
                      <AbilityRichText
                        text={note}
                        you={mu.you.name}
                        them={mu.them.name}
                        kits={kits}
                      />
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab !== 'Quick' && !mu.authored ? (
          <div className={styles.mobileTabBody}>
            <div className={styles.deepEmpty}>
              <div className={styles.deepK}>{tab.toUpperCase()} NOT WRITTEN YET</div>
              <p>
                {mu.you.name} into {mu.them.name} has no authored breakdown yet. Check back shortly
                while we write it. The Quick tab still carries the modelled read from win rates.
              </p>
              <button type="button" className={styles.deepCta} onClick={() => setTab('Quick')}>
                See the modelled read
              </button>
            </div>
          </div>
        ) : null}

        {tab === 'Plan' && mu.authored ? (
          <div className={styles.mobileTabBody}>
            {mu.phases.map((p) => (
              <div key={p.n} className={styles.mobilePhase} style={{ borderTopColor: p.c }}>
                <div className={styles.mobilePhaseHead}>
                  <span style={{ color: p.c }}>{p.n}</span>
                  <span>{p.t}</span>
                </div>
                <p>
                  <AbilityRichText
                    text={p.body}
                    id={`mph-${p.n}`}
                    you={mu.you.name}
                    them={mu.them.name}
                    kits={kits}
                  />
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'Trades' && mu.authored ? (
          <div className={styles.mobileTabBody}>
            <TradeColumn
              kind="good"
              steps={mu.trades.good.steps}
              out={mu.trades.good.out}
              you={mu.you.name}
              them={mu.them.name}
              kits={kits}
            />
            <TradeColumn
              kind="bad"
              steps={mu.trades.bad.steps}
              out={mu.trades.bad.out}
              you={mu.you.name}
              them={mu.them.name}
              kits={kits}
            />
          </div>
        ) : null}

        {tab === 'Build' && mu.authored ? (
          <div className={styles.mobileTabBody}>
            <p className={styles.needSource}>
              Items and runes need a build source. We will not invent them from lane win rates.
            </p>
          </div>
        ) : null}
      </div>

      <div className={styles.body}>
        <div className={styles.main}>
          {mu.authored ? (
            <>
              <section>
                <div className={styles.planHead}>
                  <h2 className={styles.h2}>The plan</h2>
                  <span className={styles.freshness}>{mu.freshness}</span>
                </div>
                <div className={styles.phases}>
                  {mu.phases.map((p) => (
                    <div key={p.n} className={styles.phase}>
                      <div className={styles.phaseMeta}>
                        <div className={styles.phaseN} style={{ color: p.c }}>
                          {p.n}
                        </div>
                        <div className={styles.phaseT}>{p.t}</div>
                      </div>
                      <p className={styles.phaseBody}>
                        <AbilityRichText
                          text={p.body}
                          id={`ph-${p.n}`}
                          you={mu.you.name}
                          them={mu.them.name}
                          kits={kits}
                        />
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className={styles.h2}>Trades</h2>
                <p className={styles.needSource}>
                  These are lane-strength habits, not a pairwise combo script.
                </p>
                <div className={styles.trades}>
                  <TradeColumn
                    kind="good"
                    steps={mu.trades.good.steps}
                    out={mu.trades.good.out}
                    you={mu.you.name}
                    them={mu.them.name}
                    kits={kits}
                  />
                  <TradeColumn
                    kind="bad"
                    steps={mu.trades.bad.steps}
                    out={mu.trades.bad.out}
                    you={mu.you.name}
                    them={mu.them.name}
                    kits={kits}
                  />
                </div>
              </section>
            </>
          ) : (
            <section>
              <div className={styles.modelledBanner}>
                <span className={styles.modelledDot} />
                <p>
                  No written breakdown for this pairing yet. Everything here is modelled from match
                  data. Check back shortly — we are writing the plan now.
                </p>
              </div>
              <h2 className={styles.h2}>What the data says</h2>
              <p className={styles.modelledGap}>{mu.modelled.gapLine}</p>
              {mu.modelled.counterWhy ? (
                <div className={styles.modelledWhy}>
                  <div className={styles.modelledTag}>{mu.modelled.counterTag}</div>
                  <p>{mu.modelled.counterWhy}</p>
                </div>
              ) : null}
              {mu.modelled.notes.length > 0 ? (
                <div>
                  <h2 className={`${styles.h2} ${styles.modelledReadHead}`}>
                    Reading {mu.them.name}
                  </h2>
                  <div className={styles.modelledNotes}>
                    {mu.modelled.notes.map((note) => (
                      <div key={note} className={styles.modelledNote}>
                        <span />
                        <p>
                          <AbilityRichText
                            text={note}
                            you={mu.you.name}
                            them={mu.them.name}
                            kits={kits}
                          />
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className={styles.modelledFoot}>
                Written breakdowns cover lane phases, ability windows and build reasoning. Check
                back shortly while we write this pairing.
              </p>
            </section>
          )}

          <section>
            <h2 className={styles.h2}>Reading the abilities</h2>
            {mu.abilities.length > 0 ? (
              <div className={styles.interactions}>
                {mu.abilities.map((x, i) => {
                  const key = `i${i}`;
                  const isOpen = open === key;
                  return (
                    <div
                      key={key}
                      className={styles.ability}
                      onClick={() => toggle(key)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggle(key);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <AbilityChip
                        id={`mu-ab-${x.own ? 'you' : 'them'}-${x.k}`}
                        slot={`${(x.own ? mu.you.name : mu.them.name).toUpperCase()} · ${abilitySlotLabel(x.k)}`}
                        name={x.n}
                        text={x.note}
                        letter={x.k}
                        imageUrl={x.imageUrl}
                        size={42}
                      />
                      <span className={styles.abilityCopy}>
                        <span className={styles.abilityTitle}>
                          <span className={styles.abilityName}>{x.n}</span>
                          <span className={styles.abilityOwner}>
                            {x.own ? mu.you.name : mu.them.name}
                          </span>
                        </span>
                        <span className={styles.abilityLine}>
                          {isOpen ? (
                            x.authored ? (
                              <AbilityRichText
                                text={x.note}
                                id={`ab-why-${key}`}
                                you={mu.you.name}
                                them={mu.them.name}
                                kits={kits}
                              />
                            ) : (
                              <AbilityMarkup text={x.note} />
                            )
                          ) : x.authored && x.when && x.then ? (
                            <AbilityRichText
                              text={`${x.when} — ${x.then}`}
                              id={`ab-line-${key}`}
                              you={mu.you.name}
                              them={mu.them.name}
                              kits={kits}
                            />
                          ) : (
                            'Live kit text — tap for the full description'
                          )}
                        </span>
                      </span>
                      <span className={styles.abilityWin}>
                        <span>{x.authored && x.win ? x.win : 'Kit'}</span>
                        <span className={styles.why}>Why?</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.needSource}>
                Ability text fills in when the champion kit is scraped.
              </p>
            )}
          </section>

          {mu.authored ? (
            <section>
              <h2 className={styles.h2}>Mistakes to avoid</h2>
              <div className={styles.mistakes}>
                {mu.mistakes.map((m) => (
                  <div key={m} className={styles.mistake}>
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#E58B7B"
                      strokeWidth="2.4"
                      aria-hidden
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v5M12 16.2v.1" />
                    </svg>
                    <span>
                    <AbilityRichText
                      text={m}
                      you={mu.you.name}
                      them={mu.them.name}
                      kits={kits}
                    />
                  </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className={styles.rail}>
          <div className={styles.railLabel}>WHEN CAN I FIGHT</div>
          <div className={styles.timeline}>
            {mu.spikes.length > 0
              ? mu.spikes.map((spike) => {
                  const color =
                    spike.who === 'them' ? '#E58B7B' : spike.who === 'you' ? '#8FEDB8' : '#F0A87B';
                  return (
                    <div key={spike.at} className={styles.spike}>
                      <div className={styles.spikeTrack}>
                        <span className={styles.spikeDot} style={{ background: color }} />
                        <span className={styles.spikeStem} />
                      </div>
                      <div className={styles.spikeCopy}>
                        <div className={styles.spikeAt} style={{ color }}>
                          {spike.at}
                        </div>
                        <div className={styles.spikeLabel}>
                          <AbilityRichText
                            text={spike.label}
                            id={`spike-${spike.at}`}
                            you={mu.you.name}
                            them={mu.them.name}
                            kits={kits}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              : [
                  { at: 'THIS SNAPSHOT', color: verdictC, label: mu.verdict },
                  { at: 'SAMPLE', color: '#9FCBE4', label: mu.sample },
                ].map((row) => (
                  <div key={row.at} className={styles.spike}>
                    <div className={styles.spikeTrack}>
                      <span className={styles.spikeDot} style={{ background: row.color }} />
                      <span className={styles.spikeStem} />
                    </div>
                    <div className={styles.spikeCopy}>
                      <div className={styles.spikeAt} style={{ color: row.color }}>
                        {row.at}
                      </div>
                      <div className={styles.spikeLabel}>{row.label}</div>
                    </div>
                  </div>
                ))}
          </div>

          <div className={styles.railLabel}>LANE STYLE</div>
          <div className={styles.styleTitle}>{mu.style}</div>
          <div className={styles.styleBar}>
            <div className={styles.styleKnob} style={{ left: `${mu.stylePos}%` }} />
          </div>
          <div className={styles.styleEnds}>
            <span>DEFENSIVE</span>
            <span>ALL-IN</span>
          </div>

          <div className={styles.divider} />

          <div className={styles.railLabel}>THEIR CHAMPION</div>
          <div className={styles.team}>
            <div className={styles.teamChamp}>
              <ThemSplash name={mu.them.name} slug={mu.them.slug} champions={champions} />
              <span className={styles.teamName}>{mu.them.name}</span>
            </div>
          </div>
          {mu.tags.length > 0 ? (
            <div className={styles.tags}>
              {mu.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          ) : null}

          <div className={styles.divider} />

          <div className={styles.railLabel}>BUILD BECAUSE OF THIS LANE</div>
          <p className={styles.needSource}>
            Items and runes need a build source. We will not invent them from lane win rates.
          </p>

          <div className={styles.divider} />

          <div className={styles.coach}>
            <div className={styles.railLabel}>COACHING</div>
            <div className={styles.coachTitle}>Explain my game plan</div>
            {coach === 'idle' ? (
              <>
                <p className={styles.coachCopy}>
                  Restates the live {mu.lane} snapshot. It will not invent items, runes, or pairwise
                  combos.
                </p>
                <button type="button" className={styles.coachBtn} onClick={runCoach}>
                  Generate
                </button>
              </>
            ) : null}
            {coach === 'loading' ? (
              <div className={styles.coachWait}>
                <div className={styles.coachWaitRow}>
                  <Spinner />
                  <span>Reading {mu.sample}…</span>
                </div>
                {showCoachSkel ? (
                  <div className={styles.coachSkel}>
                    <div data-skel="2" className={styles.coachBar} />
                    <div data-skel="3" className={styles.coachBar} />
                    <div data-skel="3" className={styles.coachBar} />
                  </div>
                ) : null}
              </div>
            ) : null}
            {coach === 'done' ? (
              <>
                {brief.map((b) => (
                  <div key={b.n} className={styles.coachLine}>
                    <div className={styles.coachN}>{b.n}</div>
                    <div className={styles.coachT}>
                      <AbilityRichText
                        text={b.t}
                        id={`coach-${b.n}`}
                        you={mu.you.name}
                        them={mu.them.name}
                        kits={kits}
                      />
                    </div>
                  </div>
                ))}
                <button type="button" className={styles.coachGhost} onClick={runCoach}>
                  Regenerate
                </button>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </RefreshFrame>
  );
}

export function MatchupHeroSkeleton() {
  return (
    <div className={styles.poster} aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading matchup</p>
      <div className={`${styles.youPane} ${styles.skelPane}`} />
      <div className={`${styles.themPane} ${styles.skelPane}`} />
      <div className={styles.seam} aria-hidden />
      <div className={styles.posterYou}>
        <span data-skel="2" className={`skel-text ${styles.kickerYou}`}>
          YOU PICKED
        </span>
        <span data-skel="1" className={`skel-text ${styles.posterName}`}>
          VOLIBEAR
        </span>
        <span data-skel="3" className={`skel-text ${styles.posterMeta}`}>
          Top · Fighter · 4,182 games
        </span>
      </div>
      <div className={styles.posterThem}>
        <span data-skel="2" className={`skel-text ${styles.kickerThem}`}>
          AGAINST
        </span>
        <span data-skel="1" className={`skel-text ${styles.posterName}`}>
          VOLIBEAR
        </span>
        <span data-skel="3" className={`skel-text ${styles.posterMeta}`}>
          Top · Fighter · 4,182 games
        </span>
      </div>
      <div className={styles.posterBar}>
        <div className={styles.oneThing}>
          <div data-skel="2" className={styles.skelRuleK} />
          <div data-skel="3" className={styles.skelRuleV} />
        </div>
      </div>
    </div>
  );
}

function PosterHero({
  you,
  them,
  champions,
  mu,
  chips,
}: {
  you: MatchupSideCard;
  them: MatchupSideCard;
  champions: ApiChampion[];
  mu: MatchupCard;
  chips: MatchupChip[];
}) {
  return (
    <div className={styles.poster}>
      <SplashPane name={you.name} slug={you.slug} bg={you.bg} side="you" champions={champions} />
      <SplashPane
        name={them.name}
        slug={them.slug}
        bg={them.bg}
        side="them"
        champions={champions}
      />
      <div className={styles.seam} aria-hidden />

      <div className={styles.posterYou}>
        <div className={styles.kickerYou}>YOU PICKED</div>
        <div className={styles.posterName}>{you.name.toUpperCase()}</div>
        <div className={styles.posterMeta}>
          {you.role} · {laneNice(mu.lane)}
        </div>
      </div>
      <div className={styles.posterThem}>
        <div className={styles.kickerThem}>AGAINST</div>
        <div className={styles.posterName}>{them.name.toUpperCase()}</div>
        <div className={styles.posterMeta}>
          {them.role} · {mu.sample}
        </div>
      </div>

      <div className={styles.seamStack}>
        <div className={styles.vs}>VS</div>
        <div className={styles.scoreRing}>
          <div className={styles.score}>{mu.score.toFixed(1)}</div>
          <div className={styles.diff}>{mu.difficulty.toUpperCase()}</div>
        </div>
        <div className={styles.verdict}>
          <span className={styles.verdictDot} />
          {mu.verdict}
        </div>
      </div>

      <div className={styles.posterBar}>
        <div className={styles.oneThing}>
          <div className={styles.oneThingK}>THE ONE THING</div>
          <div className={styles.oneThingV}>{mu.rule}</div>
        </div>
        <div className={styles.heroChips}>
          {chips.map((q) => (
            <div key={q.k} className={styles.heroChip}>
              <div className={styles.chipK}>{q.k}</div>
              <div className={styles.chipV} style={{ color: q.c }}>
                {q.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileHero({
  you,
  them,
  portraits,
  mu,
  chips,
}: {
  you: MatchupSideCard;
  them: MatchupSideCard;
  portraits: Record<string, string>;
  mu: MatchupCard;
  chips: MatchupChip[];
}) {
  return (
    <div className={styles.mobileHero}>
      <div className={styles.mobileGlow} aria-hidden />
      <div className={styles.mobileTop}>
        <div className={styles.mobileFaces}>
          <ChampFace
            name={you.name}
            slug={you.slug}
            size={60}
            round="circle"
            portraits={portraits}
          />
          <ChampFace
            name={them.name}
            slug={them.slug}
            size={60}
            round="circle"
            portraits={portraits}
          />
        </div>
        <div className={styles.mobileIdentity}>
          <div className={styles.kickerYou}>YOU PICKED</div>
          <div className={styles.mobileNames}>
            {you.name} <span>vs</span> {them.name}
          </div>
        </div>
      </div>
      <div className={styles.mobileScore}>
        <div className={styles.verdict}>
          <span className={styles.verdictDot} />
          {mu.verdict}
        </div>
        <div className={styles.mobileBar}>
          <div className={styles.mobileBarFill} style={{ width: `${mu.score * 10}%` }} />
        </div>
        <div className={styles.mobileScoreNum}>
          <span>{mu.score.toFixed(1)}</span>
          <span>/10</span>
        </div>
      </div>
      <div className={styles.mobileSub}>
        {laneNice(mu.lane)} · {mu.difficulty} · {mu.sample}
      </div>
      <div className={styles.mobileRule}>
        <div className={styles.oneThingK}>THE ONE THING</div>
        <div className={styles.mobileRuleV}>{mu.rule}</div>
      </div>
      <div className={styles.mobileChips}>
        {chips.map((q) => (
          <div key={q.k} className={styles.mobileChip}>
            <div className={styles.chipK}>{q.k}</div>
            <div className={styles.chipV} style={{ color: q.c }}>
              {q.v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThemSplash({
  name,
  slug,
  champions,
}: {
  name: string;
  slug: string;
  champions: ApiChampion[];
}) {
  const champ = champions.find((c) => c.slug === slug);
  const art = splashFor(slug, champ?.imageUrl);
  const focus = cardFocusFor(slug);
  return (
    <div className={styles.teamArt} style={{ background: FACE_FALLBACK_BG }}>
      {art ? (
        <Image
          src={art}
          alt=""
          fill
          className={styles.splash}
          style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
          sizes="284px"
          quality={90}
        />
      ) : (
        <ChampFace name={name} slug={slug} size={48} round="soft" fill />
      )}
    </div>
  );
}

function SplashPane({
  name,
  slug,
  bg,
  side,
  champions,
}: {
  name: string;
  slug: string;
  bg: string;
  side: 'you' | 'them';
  champions: ApiChampion[];
}) {
  const champ = champions.find((c) => c.slug === slug);
  const art = splashFor(slug, champ?.imageUrl);
  const focus = heroFocus(slug, side);
  return (
    <div className={side === 'you' ? styles.youPane : styles.themPane} style={{ background: bg }}>
      {art ? (
        <Image
          src={art}
          alt=""
          fill
          className={styles.splash}
          style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
          sizes="(max-width: 900px) 100vw, 60vw"
          quality={90}
          priority
        />
      ) : (
        <span className={side === 'you' ? styles.iniYou : styles.iniThem} aria-hidden>
          {initials(name)}
        </span>
      )}
      <span className={side === 'you' ? styles.youFade : styles.themFade} aria-hidden />
    </div>
  );
}

function TradeColumn({
  kind,
  steps,
  out,
  you,
  them,
  kits,
}: {
  kind: 'good' | 'bad';
  steps: string[];
  out: string;
  you: string;
  them: string;
  kits: Record<string, ReturnType<typeof resolveAbilities>>;
}) {
  const good = kind === 'good';
  return (
    <div>
      <div className={good ? styles.tradeHeadGood : styles.tradeHeadBad}>
        {good ? 'DO THIS' : 'NOT THIS'}
      </div>
      {steps.map((step, i) => (
        <div key={step} className={styles.tradeStep}>
          <span className={good ? styles.tradeNGood : styles.tradeNBad}>{i + 1}</span>
          <span className={good ? styles.tradeTGood : styles.tradeTBad}>
            <AbilityRichText text={step} id={`${kind}-${i}`} you={you} them={them} kits={kits} />
          </span>
        </div>
      ))}
      <div className={good ? styles.tradeOutGood : styles.tradeOutBad}>
        <AbilityRichText text={out} id={`${kind}-out`} you={you} them={them} kits={kits} />
      </div>
    </div>
  );
}

function SuggestBlock({
  label,
  champions,
  side,
  lane,
  placements,
  portraits,
  onPick,
}: {
  label: string;
  champions: ApiChampion[];
  side: 'you' | 'them';
  lane: TierLane;
  placements: TierPlacementDto[];
  portraits: Record<string, string>;
  onPick: (slug: string) => void;
}) {
  return (
    <div className={styles.emptyBlock}>
      <div className={styles.emptyK}>{label}</div>
      <div className={styles.oneSuggest}>
        {champions.map((champion) => {
          const place = bestPlacement(placementsForSlug(placements, champion.slug), lane);
          return (
            <button
              key={champion.slug}
              type="button"
              className={side === 'them' ? styles.oneSuggestThem : styles.oneSuggestYou}
              onClick={() => onPick(champion.slug)}
            >
              <ChampFace name={champion.name} slug={champion.slug} size={42} portraits={portraits} />
              <span className={styles.oneSuggestCopy}>
                <span className={styles.oneSuggestName}>{champion.name}</span>
                <span className={styles.oneSuggestRole}>{place?.lane ?? roleLabel(champion.roles)}</span>
              </span>
              <span
                className={styles.oneSuggestWr}
                style={{ color: place && place.winRate >= 52 ? '#8FEDB8' : '#F0A87B' }}
              >
                {place ? formatRate(place.winRate) : '—'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MatchupSelect({
  champions = [],
  youSlug,
  themSlug,
  lane,
  placements = [],
  roleOrder = TIER_LANES as TierLane[],
}: MatchupProps) {
  const router = useRouter();
  const portraits = portraitsFromRoster(champions);
  const [picking, setPicking] = useState<'you' | 'them' | null>(null);
  const [pool, setPool] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedMatchupRow[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      void loadAccountState(supabase, data.user.id).then((state) => {
        setPool(state.pool);
        setSaved(state.saved);
      });
    });
  }, []);

  function setPair(next: { you?: string | null; them?: string | null; lane?: string | null }) {
    const params = new URLSearchParams();
    const you = next.you === undefined ? youSlug : next.you;
    const them = next.them === undefined ? themSlug : next.them;
    const nextLane = next.lane === undefined ? lane : next.lane;
    if (you) params.set('you', you);
    if (them) params.set('them', them);
    if (nextLane) params.set('lane', nextLane);
    startTransition(() => {
      router.replace(params.size ? `/matchups?${params}` : '/matchups');
    });
  }

  function laneFor(slug: string): string {
    const lanes = placementsForSlug(placements, slug).map((row) => row.lane);
    return preferredLaneOf(lanes, roleOrder) ?? lane;
  }

  const youChamp = champions.find((champion) => champion.slug === youSlug);
  const themChamp = champions.find((champion) => champion.slug === themSlug);
  const oneSlug = youSlug || themSlug;
  const oneChamp = youChamp ?? themChamp;
  const oneLanes = oneSlug ? placementsForSlug(placements, oneSlug).map((row) => row.lane) : [];
  const suggestLane = (TIER_LANES.includes(lane as TierLane) ? (lane as TierLane) : undefined)
    ?? preferredLaneOf(oneLanes, roleOrder)
    ?? 'Top';
  const poolChips = useMemo(
    () =>
      poolInLane(pool, placements, suggestLane)
        .slice(0, 5)
        .flatMap((slug) => {
          const champion = champions.find((item) => item.slug === slug);
          return champion ? [champion] : [];
        }),
    [champions, placements, pool, suggestLane],
  );
  const commonOpponents = useMemo(
    () => commonLaneChampions(champions, placements, suggestLane, [youSlug, themSlug], 6),
    [champions, placements, suggestLane, themSlug, youSlug],
  );
  const youSuggest = useMemo(
    () => youLaneSuggestions(champions, placements, suggestLane, pool, [themSlug], 6),
    [champions, placements, pool, suggestLane, themSlug],
  );

  return (
    <div>
      <div className={styles.pickerBar}>
        <button type="button" className={styles.pairPick} onClick={() => setPicking('you')}>
          {youChamp ? (
            <ChampFace name={youChamp.name} slug={youChamp.slug} size={30} portraits={portraits} />
          ) : (
            <span className={styles.pairEmptyYou}>+</span>
          )}
          <span className={styles.pairCopy}>
            <span className={styles.pairKYou}>YOU</span>
            <span className={styles.pairName}>{youChamp?.name ?? 'Choose champion'}</span>
          </span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7B769B" strokeWidth="2.4" aria-hidden>
            <path d="M6 9.5l6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.swapBtn}
          onClick={() => setPair({ you: themSlug || null, them: youSlug || null })}
          aria-label="Swap champions"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BBB7D4" strokeWidth="2.2">
            <path d="M4 8h14l-3.4-3.4M20 16H6l3.4 3.4" />
          </svg>
        </button>
        <button type="button" className={styles.pairPickThem} onClick={() => setPicking('them')}>
          {themChamp ? (
            <ChampFace name={themChamp.name} slug={themChamp.slug} size={30} portraits={portraits} />
          ) : (
            <span className={styles.pairEmptyThem}>+</span>
          )}
          <span className={styles.pairCopy}>
            <span className={styles.pairKThem}>AGAINST</span>
            <span className={styles.pairName}>{themChamp?.name ?? 'Choose opponent'}</span>
          </span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7B769B" strokeWidth="2.4" aria-hidden>
            <path d="M6 9.5l6 6 6-6" />
          </svg>
        </button>
        <div className={`${styles.pickLanes} xfade`}>
          {TIER_LANES.map((item) => (
            <button
              key={item}
              type="button"
              className={lane === item ? styles.pickLaneOn : styles.pickLane}
              onClick={() => setPair({ lane: item })}
            >
              <LaneGlyph lane={item} />
              {item}
            </button>
          ))}
        </div>
      </div>

      <ChampionPicker
        open={picking !== null}
        title={picking === 'them' ? 'Pick the opponent' : 'Pick your champion'}
        champions={champions}
        portraits={portraits}
        exclude={picking === 'you' ? [themSlug] : [youSlug]}
        onClose={() => setPicking(null)}
        onPick={(champion) => {
          const nextLane = laneFor(champion.slug);
          if (picking === 'you') setPair({ you: champion.slug, lane: nextLane });
          if (picking === 'them') setPair({ them: champion.slug, lane: nextLane });
          setPicking(null);
        }}
      />

      {!youSlug && !themSlug ? (
        <div className={styles.emptyWrap}>
          <div className={styles.emptyInner}>
            <div className={styles.emptyFaces}>
              <span className={styles.emptyPlusYou}>+</span>
              <span className={styles.emptyPlusThem}>+</span>
            </div>
            <h1 className={styles.emptyTitle}>Pick two champions</h1>
            <p className={styles.emptyCopy}>
              Choose the champion you are playing and the one you are laning against. Forge reads
              the pairing and tells you how to play the first ten minutes.
            </p>
            <div className={styles.emptyActions}>
              <button type="button" className={styles.emptyPrimary} onClick={() => setPicking('you')}>
                Pick your champion
              </button>
              <button type="button" className={styles.emptyGhost} onClick={() => setPicking('them')}>
                Pick the opponent
              </button>
            </div>
            {saved.length > 0 ? (
              <div className={styles.emptyBlock}>
                <div className={styles.emptyK}>PICK UP A SAVED MATCHUP</div>
                <div className={styles.emptySaved}>
                  {saved.slice(0, 3).map((row, index) => {
                    const you = champions.find((champion) => champion.slug === row.youSlug);
                    const them = champions.find((champion) => champion.slug === row.themSlug);
                    if (!you || !them) return null;
                    return (
                      <button
                        key={`${row.youSlug}-${row.themSlug}-${row.lane}`}
                        type="button"
                        className={styles.emptySavedRow}
                        style={{
                          borderBottom:
                            index < Math.min(saved.length, 3) - 1
                              ? '1px solid rgba(255,255,255,.06)'
                              : 'none',
                        }}
                        onClick={() =>
                          setPair({ you: row.youSlug, them: row.themSlug, lane: row.lane })
                        }
                      >
                        <span className={styles.emptySavedFaces}>
                          <ChampFace name={you.name} slug={you.slug} size={34} portraits={portraits} />
                          <span className={styles.emptySavedThem}>
                            <ChampFace name={them.name} slug={them.slug} size={34} portraits={portraits} />
                          </span>
                        </span>
                        <span className={styles.emptySavedTitle}>
                          {you.name} <span>vs</span> {them.name}
                        </span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C5878" strokeWidth="2.2" aria-hidden>
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {poolChips.length > 0 ? (
              <div className={styles.emptyBlock}>
                <div className={styles.emptyK}>OR START FROM YOUR POOL</div>
                <div className={styles.emptyPool}>
                  {poolChips.map((champion) => (
                    <button
                      key={champion.slug}
                      type="button"
                      className={styles.emptyPoolChip}
                      onClick={() => setPair({ you: champion.slug, lane: suggestLane })}
                    >
                      <ChampFace
                        name={champion.name}
                        slug={champion.slug}
                        size={30}
                        portraits={portraits}
                      />
                      {champion.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {commonOpponents.length > 0 ? (
              <div className={styles.emptyBlock}>
                <div className={styles.emptyK}>
                  COMMON {suggestLane.toUpperCase()} LANE OPPONENTS
                </div>
                <div className={styles.emptyPool}>
                  {commonOpponents.slice(0, 5).map((champion) => (
                    <button
                      key={champion.slug}
                      type="button"
                      className={styles.emptyPoolChip}
                      onClick={() => setPair({ them: champion.slug, lane: suggestLane })}
                    >
                      <ChampFace
                        name={champion.name}
                        slug={champion.slug}
                        size={30}
                        portraits={portraits}
                      />
                      {champion.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className={styles.oneWrap}>
          <div className={styles.oneInner}>
            <div className={styles.onePair}>
              <div className={styles.oneSide}>
                <span
                  className={styles.oneFace}
                  style={{
                    borderColor: youSlug ? 'rgba(22,192,255,.55)' : 'rgba(229,139,123,.55)',
                  }}
                >
                  {oneChamp ? (
                    <ChampFace
                      name={oneChamp.name}
                      slug={oneChamp.slug}
                      size={74}
                      portraits={portraits}
                    />
                  ) : null}
                </span>
                <div>
                  <div
                    className={styles.oneLabel}
                    style={{ color: youSlug ? '#7FDCFF' : '#E58B7B' }}
                  >
                    {youSlug ? 'YOU PICKED' : 'AGAINST'}
                  </div>
                  <div className={styles.oneName}>{oneChamp?.name}</div>
                  <div className={styles.oneRole}>
                    {bestPlacement(oneLanes.length ? placementsForSlug(placements, oneSlug) : [], suggestLane)
                      ?.lane ?? roleLabel(oneChamp?.roles ?? [])}
                  </div>
                </div>
              </div>
              <div className={styles.oneVs}>VS</div>
              <div className={styles.oneSide}>
                <span
                  className={styles.oneEmptyFace}
                  style={{
                    borderColor: youSlug ? 'rgba(229,139,123,.5)' : 'rgba(22,192,255,.5)',
                  }}
                >
                  +
                </span>
                <div>
                  <div className={styles.oneEmptyLabel}>{youSlug ? 'AGAINST' : 'YOU PICK'}</div>
                  <div className={styles.oneEmptyName}>Not chosen</div>
                </div>
              </div>
            </div>
            <h1 className={styles.oneTitle}>
              {youSlug ? 'Now pick the opponent' : 'Now pick your champion'}
            </h1>
            <p className={styles.oneCopy}>
              {youSlug
                ? `${oneChamp?.name} is locked in. Choose who you are laning against and Forge will read the pairing.`
                : `You are up against ${oneChamp?.name}. Choose the champion you are playing.`}
            </p>
            <button
              type="button"
              className={styles.emptyPrimary}
              onClick={() => setPicking(youSlug ? 'them' : 'you')}
            >
              Browse all champions
            </button>
            {youSlug && commonOpponents.length > 0 ? (
              <SuggestBlock
                label={`COMMON ${suggestLane.toUpperCase()} LANE OPPONENTS`}
                champions={commonOpponents}
                side="them"
                lane={suggestLane}
                placements={placements}
                portraits={portraits}
                onPick={(slug) => setPair({ them: slug, lane: suggestLane })}
              />
            ) : null}
            {!youSlug && youSuggest.fromPool.length > 0 ? (
              <SuggestBlock
                label="OR START FROM YOUR POOL"
                champions={youSuggest.fromPool}
                side="you"
                lane={suggestLane}
                placements={placements}
                portraits={portraits}
                onPick={(slug) => setPair({ you: slug, lane: suggestLane })}
              />
            ) : null}
            {!youSlug && youSuggest.more.length > 0 ? (
              <SuggestBlock
                label={`STRONG ${suggestLane.toUpperCase()} PICKS`}
                champions={youSuggest.more}
                side="you"
                lane={suggestLane}
                placements={placements}
                portraits={portraits}
                onPick={(slug) => setPair({ you: slug, lane: suggestLane })}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
