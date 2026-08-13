'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ApiChampion } from '@/lib/api';
import { bannerFocusFor } from '@/lib/banner-focus';
import { initials, portraitsFromRoster, splashFor } from '@/lib/champions';
import { coachBriefFor, MATCHUP_STUB, metaFor } from '@/lib/design-stubs';
import { ChampFace } from './ChampFace';
import styles from './MatchupView.module.css';

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

export function MatchupView({ champions = [] }: { champions?: ApiChampion[] }) {
  const mu = MATCHUP_STUB;
  const you = metaFor(mu.you);
  const them = metaFor(mu.them);
  const portraits = portraitsFromRoster(champions);
  const [open, setOpen] = useState<string | null>(null);
  const [coach, setCoach] = useState<'idle' | 'loading' | 'done'>('idle');
  const coachTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const brief = coachBriefFor(mu);

  useEffect(() => () => clearTimeout(coachTimer.current), []);

  function runCoach() {
    clearTimeout(coachTimer.current);
    setCoach('loading');
    coachTimer.current = setTimeout(() => setCoach('done'), 1100);
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

  const chips = mu.quick.filter((q) => q.k === 'PLAYSTYLE' || q.k === 'PUNISH');

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
      <PosterHero you={you} them={them} champions={champions} mu={mu} chips={chips} />
      <MobileHero you={you} them={them} portraits={portraits} mu={mu} chips={chips} />

      <div className={styles.body}>
        <div className={styles.main}>
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
            <div className={styles.trades}>
              <TradeColumn kind="good" steps={mu.good.steps} out={mu.good.out} />
              <TradeColumn kind="bad" steps={mu.bad.steps} out={mu.bad.out} />
            </div>
          </section>

          <section>
            <h2 className={styles.h2}>Reading the abilities</h2>
            <div className={styles.interactions}>
              {mu.interactions.map((x, i) => {
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
                        <span className={styles.abilityOwner}>{x.own ? mu.you : mu.them}</span>
                      </span>
                      <span className={styles.abilityLine}>
                        {x.when} — {x.then}
                      </span>
                      {isOpen ? <span className={styles.abilityNote}>{x.note}</span> : null}
                    </span>
                    <span className={styles.abilityWin}>
                      <span>{x.win}</span>
                      <span className={styles.why}>Why?</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className={styles.h2}>Mistakes to avoid</h2>
            <div className={styles.mistakes}>
              {mu.mistakes.map((m) => (
                <div key={m} className={styles.mistake}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E58B7B" strokeWidth="2.4" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5M12 16.2v.1" />
                  </svg>
                  <span>{m}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.rail}>
          <div className={styles.railLabel}>WHEN CAN I FIGHT</div>
          <div className={styles.timeline}>
            {mu.spikes.map((s) => {
              const c = s.who === 'you' ? '#8FEDB8' : s.who === 'them' ? '#E58B7B' : '#F0A87B';
              return (
                <div key={s.at} className={styles.spike}>
                  <div className={styles.spikeTrack}>
                    <span className={styles.spikeDot} style={{ background: c }} />
                    <span className={styles.spikeStem} />
                  </div>
                  <div className={styles.spikeCopy}>
                    <div className={styles.spikeAt} style={{ color: c }}>
                      {s.at}
                    </div>
                    <div className={styles.spikeLabel}>{s.label}</div>
                  </div>
                </div>
              );
            })}
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

          <div className={styles.railLabel}>ENEMY TEAM</div>
          <div className={styles.team}>
            {mu.team.map((n) => (
              <div key={n} className={styles.teamChamp}>
                <div className={styles.teamArt}>
                  <ChampFace name={n} size={48} round="soft" fill portraits={portraits} />
                </div>
                <span className={styles.teamName}>{n}</span>
              </div>
            ))}
          </div>
          <div className={styles.tags}>
            {mu.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>

          <div className={styles.divider} />

          <div className={styles.railLabel}>BUILD BECAUSE OF THIS LANE</div>
          <div className={styles.gearList}>
            {mu.items.map((item, i) => {
              const key = `it${i}`;
              return (
                <button key={item.n} type="button" className={styles.gear} onClick={() => toggle(key)}>
                  <span className={styles.itemSwatch} style={{ background: `${item.c}1F`, borderColor: item.c }} />
                  <span className={styles.gearCopy}>
                    <span className={styles.gearHead}>
                      <span className={styles.gearName}>{item.n}</span>
                      <span className={styles.gearKind} style={{ color: item.c }}>
                        {item.kind}
                      </span>
                    </span>
                    <span className={styles.gearShort}>{item.short}</span>
                    {open === key ? <span className={styles.gearDetail}>{item.detail}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.divider} />

          <div className={styles.railLabel}>RUNES</div>
          <div className={styles.gearList}>
            {mu.runes.map((rune, i) => {
              const key = `r${i}`;
              return (
                <button key={rune.n} type="button" className={styles.gear} onClick={() => toggle(key)}>
                  <span className={styles.runeSwatch} style={{ background: `${rune.c}1F`, borderColor: rune.c }} />
                  <span className={styles.gearCopy}>
                    <span className={styles.gearHead}>
                      <span className={styles.gearName}>{rune.n}</span>
                      <span className={styles.gearKind} style={{ color: rune.c }}>
                        {rune.kind}
                      </span>
                    </span>
                    <span className={styles.gearShort}>{rune.short}</span>
                    {open === key ? <span className={styles.gearDetail}>{rune.detail}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.coach}>
            <div className={styles.railLabel}>COACHING</div>
            <div className={styles.coachTitle}>Explain my game plan</div>
            {coach === 'idle' ? (
              <>
                <p className={styles.coachCopy}>
                  Combines this matchup with both teams and your build into a short brief.
                </p>
                <button type="button" className={styles.coachBtn} onClick={runCoach}>
                  Generate
                </button>
              </>
            ) : null}
            {coach === 'loading' ? (
              <>
                <p className={styles.coachCopy}>Reading {mu.sample}…</p>
                <div className={styles.coachSkel} aria-hidden>
                  <div className={styles.coachBar} />
                  <div className={styles.coachBar} />
                  <div className={styles.coachBar} />
                </div>
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
  you: ReturnType<typeof metaFor>;
  them: ReturnType<typeof metaFor>;
  champions: ApiChampion[];
  mu: typeof MATCHUP_STUB;
  chips: typeof MATCHUP_STUB.quick;
}) {
  return (
    <div className={styles.poster}>
      <SplashPane
        name={you.name}
        slug={you.slug}
        bg={you.bg}
        side="you"
        champions={champions}
      />
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
  you: ReturnType<typeof metaFor>;
  them: ReturnType<typeof metaFor>;
  portraits: Record<string, string>;
  mu: typeof MATCHUP_STUB;
  chips: typeof MATCHUP_STUB.quick;
}) {
  return (
    <div className={styles.mobileHero}>
      <div className={styles.mobileGlow} aria-hidden />
      <div className={styles.mobileTop}>
        <div className={styles.mobileFaces}>
          <ChampFace name={you.name} size={60} round="circle" portraits={portraits} />
          <ChampFace name={them.name} size={60} round="circle" portraits={portraits} />
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
        {laneNice(mu.lane)} · {mu.difficulty} · {mu.sample} · patch 6.2b
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

function TradeColumn({
  kind,
  steps,
  out,
}: {
  kind: 'good' | 'bad';
  steps: string[];
  out: string;
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
          <span className={good ? styles.tradeTGood : styles.tradeTBad}>{step}</span>
        </div>
      ))}
      <div className={good ? styles.tradeOutGood : styles.tradeOutBad}>{out}</div>
    </div>
  );
}
