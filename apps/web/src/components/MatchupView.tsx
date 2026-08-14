'use client';

import Image from 'next/image';
import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { TIER_LANES } from '@wild-rift-forge/game-data';
import type { ApiChampion, MatchupResponse } from '@/lib/api';
import { bannerFocusFor } from '@/lib/banner-focus';
import { initials, portraitsFromRoster, splashFor } from '@/lib/champions';
import {
  buildMatchupCard,
  coachBriefFor,
  type MatchupCard,
  type MatchupChip,
  type MatchupSideCard,
} from '@/lib/matchup-card';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { ChampFace } from './ChampFace';
import { ChampionPicker } from './ChampionPicker';
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

export function MatchupView({
  champions = [],
  matchup,
  youSlug,
  themSlug,
  lane,
}: {
  champions?: ApiChampion[];
  matchup: MatchupResponse | null;
  youSlug: string;
  themSlug: string;
  lane: string;
}) {
  const router = useRouter();
  const mu = buildMatchupCard(matchup, youSlug, themSlug, lane, champions);
  const portraits = portraitsFromRoster(champions);
  const [open, setOpen] = useState<string | null>(null);
  const [coach, setCoach] = useState<'idle' | 'done'>('idle');
  const [picking, setPicking] = useState<'you' | 'them' | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<MuTab>('Quick');
  const brief = coachBriefFor(mu);

  function setPair(next: { you?: string; them?: string; lane?: string }) {
    const params = new URLSearchParams();
    params.set('you', next.you ?? youSlug);
    params.set('them', next.them ?? themSlug);
    params.set('lane', next.lane ?? lane);
    router.replace(`/matchups?${params}`);
    setSaved(false);
    setCoach('idle');
    setTab('Quick');
  }

  function swapPair() {
    setPair({ you: themSlug, them: youSlug });
  }

  async function savePair() {
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
  }

  function runCoach() {
    setCoach('done');
  }

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
    <div style={vars}>
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
              {item}
            </button>
          ))}
        </div>
        <button type="button" className={styles.saveBtn} onClick={() => void savePair()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M7 4h10v16l-5-4-5 4z" />
          </svg>
          {saved ? 'Saved' : 'Save matchup'}
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
          if (picking === 'you') setPair({ you: champion.slug });
          if (picking === 'them') setPair({ them: champion.slug });
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
                  data.
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
                    <p>{note}</p>
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
                {mu.you.name} into {mu.them.name} has no authored breakdown. The Quick tab still
                carries the modelled read from win rates and counter data.
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
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'Trades' && mu.authored ? (
          <div className={styles.mobileTabBody}>
            <TradeColumn kind="good" steps={mu.trades.good.steps} out={mu.trades.good.out} />
            <TradeColumn kind="bad" steps={mu.trades.bad.steps} out={mu.trades.bad.out} />
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
                      <p className={styles.phaseBody}>{p.body}</p>
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
                  <TradeColumn kind="good" steps={mu.trades.good.steps} out={mu.trades.good.out} />
                  <TradeColumn kind="bad" steps={mu.trades.bad.steps} out={mu.trades.bad.out} />
                </div>
              </section>
            </>
          ) : (
            <section>
              <div className={styles.modelledBanner}>
                <span className={styles.modelledDot} />
                <p>
                  No written breakdown for this pairing yet. Everything here is modelled from match
                  data.
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
                        <p>{note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className={styles.modelledFoot}>
                Written breakdowns cover lane phases, ability windows and build reasoning. This
                pairing is queued behind the ones people open most.
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
                    <button
                      key={key}
                      type="button"
                      className={styles.ability}
                      onClick={() => toggle(key)}
                    >
                      <span
                        className={styles.abilityKey}
                        style={{
                          background: x.own ? 'rgba(22,192,255,.14)' : 'rgba(229,139,123,.14)',
                          borderColor: x.own ? 'rgba(22,192,255,.36)' : 'rgba(229,139,123,.36)',
                          color: x.own ? '#7FDCFF' : '#E58B7B',
                        }}
                      >
                        {x.k}
                      </span>
                      <span className={styles.abilityCopy}>
                        <span className={styles.abilityTitle}>
                          <span className={styles.abilityName}>{x.n}</span>
                          <span className={styles.abilityOwner}>
                            {x.own ? mu.you.name : mu.them.name}
                          </span>
                        </span>
                        <span className={styles.abilityLine}>
                          {isOpen ? x.note : 'Live kit text — tap for the full description'}
                        </span>
                      </span>
                      <span className={styles.abilityWin}>
                        <span>Kit</span>
                        <span className={styles.why}>Why?</span>
                      </span>
                    </button>
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
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className={styles.rail}>
          <div className={styles.railLabel}>WHEN CAN I FIGHT</div>
          <div className={styles.timeline}>
            <div className={styles.spike}>
              <div className={styles.spikeTrack}>
                <span className={styles.spikeDot} style={{ background: verdictC }} />
                <span className={styles.spikeStem} />
              </div>
              <div className={styles.spikeCopy}>
                <div className={styles.spikeAt} style={{ color: verdictC }}>
                  THIS SNAPSHOT
                </div>
                <div className={styles.spikeLabel}>{mu.verdict}</div>
              </div>
            </div>
            <div className={styles.spike}>
              <div className={styles.spikeTrack}>
                <span className={styles.spikeDot} style={{ background: '#9FCBE4' }} />
                <span className={styles.spikeStem} />
              </div>
              <div className={styles.spikeCopy}>
                <div className={styles.spikeAt} style={{ color: '#9FCBE4' }}>
                  SAMPLE
                </div>
                <div className={styles.spikeLabel}>{mu.sample}</div>
              </div>
            </div>
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
              <div className={styles.teamArt}>
                <ChampFace
                  name={mu.them.name}
                  slug={mu.them.slug}
                  size={48}
                  round="soft"
                  fill
                  portraits={portraits}
                />
              </div>
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
            {coach === 'done' ? (
              <>
                {brief.map((b) => (
                  <div key={b.n} className={styles.coachLine}>
                    <div className={styles.coachN}>{b.n}</div>
                    <div className={styles.coachT}>{b.t}</div>
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

function TradeColumn({ kind, steps, out }: { kind: 'good' | 'bad'; steps: string[]; out: string }) {
  const good = kind === 'good';
  return (
    <div>
      <div className={good ? styles.tradeHeadGood : styles.tradeHeadBad}>
        {good ? 'DO THIS' : 'NOT THIS'}
      </div>
      {steps.map((step, i) => (
        <div key={step} className={styles.tradeStep}>
          <span className={good ? styles.tradeNGood : styles.tradeNBad}>{i + 1}</span>
          <span className={good ? styles.tradeTGood : styles.tradeTBad}>{step}</span>
        </div>
      ))}
      <div className={good ? styles.tradeOutGood : styles.tradeOutBad}>{out}</div>
    </div>
  );
}
