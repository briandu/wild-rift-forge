'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TIER_LANES } from '@wild-rift-forge/game-data';
import type {
  AbilityDto,
  CountersResponse,
  PatchChampionChangeDto,
  TierPlacementDto,
} from '@/lib/api-types';
import { resolveAbilities } from '@/lib/abilities';
import { bannerFocusFor } from '@/lib/banner-focus';
import { ART_BY_SLUG, HERO_FALLBACK, initials, portraitFor, roleLabel } from '@/lib/champions';
import { bestPlacement, formatRate, laneFromLabel, tierBadge } from '@/lib/placements';
import { abilitySlotLabel } from '@/lib/ability-mentions';
import { AbilityMarkup } from './AbilityMarkup';
import { AbilityStrip } from './AbilityStrip';
import { skeletonDelay } from '@/lib/loading';
import { AbilityChip } from './AbilityTip';
import { EmptyPanel, emptyCtaClass, FailedPanel } from './LoadState';
import { LaneGlyph } from './LaneGlyph';
import { SkillOrder } from './SkillOrder';
import { GEAR_CATALOG } from '@/lib/gear-catalog';
import styles from './ChampionProfile.module.css';

const TABLE_SKEL = ['112px', '96px', '124px', '88px', '104px', '90px', '118px'] as const;

const TABS = ['Overview', 'Matchups', 'Builds', 'Skill order', 'Pro play'] as const;

const TIER_CLASS: Record<string, string> = {
  S: styles.tierS ?? '',
  A: styles.tierA ?? '',
  B: styles.tierB ?? '',
  C: styles.tierC ?? '',
};

export function ChampionProfile({
  slug,
  name,
  title,
  roles,
  imageUrl,
  thumbnailUrl,
  abilities: abilitiesProp,
  counters,
  patchNote,
  placements,
}: {
  slug: string;
  name: string;
  title: string | null;
  roles: string[];
  imageUrl: string | null;
  thumbnailUrl?: string | null;
  abilities?: AbilityDto[] | null;
  counters: CountersResponse | null;
  patchNote?: PatchChampionChangeDto | null;
  placements: TierPlacementDto[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Matchups');
  const [dir, setDir] = useState<'beaten' | 'beats'>('beaten');
  const art = imageUrl || ART_BY_SLUG[slug] || HERO_FALLBACK;
  const focus = bannerFocusFor(slug);
  const avatar = portraitFor(slug, imageUrl, thumbnailUrl);
  const abilities = resolveAbilities(abilitiesProp ?? counters?.abilities, slug);
  const activeLane = laneFromLabel(counters?.lane);
  const placement = bestPlacement(placements, activeLane);
  const rows = counters
    ? dir === 'beaten'
      ? [
          ...counters.picks,
          ...counters.also.map((c) => ({ ...c, why: 'Reliable pick into this lane' })),
        ]
      : (counters.beats ?? counters.also.slice(0, 4)).map((c) => ({
          ...c,
          why: `Lower ${counters.lane.toLowerCase()} win rate than ${name}`,
          tag: 'GOOD COUNTER' as const,
        }))
    : [];

  return (
    <div>
      <section className={styles.hero}>
        <Image
          src={art}
          alt=""
          fill
          className={styles.heroArt}
          style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
          sizes="100vw"
          priority
          quality={90}
        />
        <div className={styles.heroFade} aria-hidden />
        <div className={styles.heroInner}>
          <div className={styles.heroLead}>
            <Link href="/champions" className={styles.back}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden
              >
                <path d="M14 6l-6 6 6 6" />
              </svg>
              All champions
            </Link>
            <div className={styles.identity}>
              <div className={styles.portrait}>
                {avatar ? (
                  <Image src={avatar} alt="" width={88} height={88} quality={90} />
                ) : (
                  initials(name)
                )}
              </div>
              <div>
                <h1 className={styles.name}>{name.toUpperCase()}</h1>
                <p className={styles.meta}>
                  {roleLabel(roles)}
                  {title ? ` · ${title}` : ''}
                  {placement ? (
                    <span className={`${styles.tier} ${TIER_CLASS[placement.letter] ?? ''}`}>
                      {tierBadge(placement.letter)}
                      {activeLane ? ` · ${activeLane}` : ''}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>
          {counters ? (
            <div className={styles.stats}>
              {counters.stats.map((s) => (
                <div key={s.label}>
                  <div className={styles.statValue}>{s.value}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className={styles.heroAbilities}>
          <AbilityStrip abilities={abilities} size="lg" overlay />
        </div>
        <div className={styles.heroFooter}>
          <div className={`${styles.tabs} xfade`} role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? styles.tabActive : styles.tab}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.body}>
        {tab === 'Overview' ? (
          <div className={styles.overview}>
            <div>
              <h2 className={styles.stubTitle}>{name}</h2>
              <p className={styles.stubCopy}>
                {title ? `${title}. ` : ''}
                {counters?.blurb ?? 'Matchups use live lane win rates, not pairwise samples.'}
              </p>
              {placement ? (
                <dl className={styles.snapshot}>
                  <div>
                    <dt>Lane</dt>
                    <dd>{placement.lane}</dd>
                  </div>
                  <div>
                    <dt>Tier</dt>
                    <dd>{placement.letter}</dd>
                  </div>
                  <div>
                    <dt>Win rate</dt>
                    <dd>{formatRate(placement.winRate)}</dd>
                  </div>
                  <div>
                    <dt>Pick rate</dt>
                    <dd>{formatRate(placement.pickRate)}</dd>
                  </div>
                </dl>
              ) : (
                <p className={styles.stubCopy}>No ranked snapshot for this champion yet.</p>
              )}
              {patchNote ? (
                <p className={styles.stubCopy}>
                  This patch: {patchNote.kind.toLowerCase()}
                  {patchNote.lines.length
                    ? ` · ${patchNote.lines.map((line) => line.t).join(' ')}`
                    : ''}
                </p>
              ) : (
                <p className={styles.stubCopy}>
                  No numbered change for {name} in the latest patch notes.
                </p>
              )}
              <button type="button" className={styles.primary} onClick={() => setTab('Matchups')}>
                Open matchups
              </button>
            </div>
            {abilities.length > 0 ? (
              <ul className={styles.kit}>
                {abilities.map((ability) => (
                  <li key={ability.key}>
                    <AbilityChip
                      id={`prof-kit-${ability.key}`}
                      slot={`${name.toUpperCase()} · ${abilitySlotLabel(ability.key)}`}
                      name={ability.name}
                      text={ability.description || `${name}'s ${ability.key} has not been written up yet.`}
                      letter={ability.key}
                      imageUrl={ability.imageUrl}
                      size={29}
                    />
                    <span>
                      <strong>{ability.name}</strong>
                      <span className={styles.kitDesc}>
                        <AbilityMarkup text={ability.description} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.stubCopy}>Kit fills in when abilities are scraped.</p>
            )}
          </div>
        ) : tab === 'Builds' ? (
          <ChampionBuilds slug={slug} />
        ) : tab === 'Skill order' ? (
          <SkillOrder name={name} abilities={abilities} />
        ) : tab === 'Pro play' ? (
          <div className={styles.stubPanel}>
            <h2 className={styles.stubTitle}>{tab} needs a data source</h2>
            <p className={styles.stubCopy}>
              We will not invent builds or skill orders. Matchups use live lane win rates.
            </p>
            <button type="button" className={styles.primary} onClick={() => setTab('Matchups')}>
              Open matchups
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            <div>
              <div className={styles.controls}>
                <div className={`${styles.lanes} xfade`} role="group" aria-label="Lane">
                  {TIER_LANES.map((lane) => {
                    const active = activeLane === lane;
                    const hasData = placements.some((row) => row.lane === lane);
                    return (
                      <Link
                        key={lane}
                        href={`/champions/${slug}?lane=${lane}`}
                        scroll={false}
                        className={active ? styles.laneActive : styles.lane}
                        aria-current={active ? 'page' : undefined}
                        data-thin={hasData ? undefined : 'true'}
                      >
                        <LaneGlyph lane={lane} />
                        {lane}
                      </Link>
                    );
                  })}
                </div>
                <div className={styles.dir}>
                  <button
                    type="button"
                    className={dir === 'beaten' ? styles.dirActive : styles.dirBtn}
                    onClick={() => setDir('beaten')}
                  >
                    Beats {name}
                  </button>
                  <button
                    type="button"
                    className={dir === 'beats' ? styles.dirActive : styles.dirBtn}
                    onClick={() => setDir('beats')}
                  >
                    {name} beats
                  </button>
                </div>
              </div>

              {!counters ? (
                <FailedPanel
                  title="Counter data did not load"
                  copy="Everything else on this page is current."
                  onRetry={() => router.refresh()}
                />
              ) : rows.length === 0 ? (
                <EmptyPanel
                  title={`No matchup rows for ${name} in this lane`}
                  copy="Check another lane, or browse the roster for a different pick."
                  action={
                    <Link href="/champions" className={emptyCtaClass()}>
                      Browse champions
                    </Link>
                  }
                />
              ) : (
                <div className={styles.table}>
                  <div className={styles.tableHead}>
                    <span>#</span>
                    <span>CHAMPION</span>
                    <span>MATCHUP SCORE</span>
                    <span>WIN RATE</span>
                    <span>GAMES</span>
                  </div>
                  {rows.map((row, i) => {
                    const cover = portraitFor(row.slug, row.imageUrl, row.thumbnailUrl);
                    return (
                      <Link key={row.slug} href={`/champions/${row.slug}`} className={styles.row}>
                        <span className={i < 3 ? styles.rankTop : styles.rank}>{i + 1}</span>
                        <span className={styles.champCell}>
                          <span className={styles.rowAvatar}>
                            {cover ? (
                              <Image src={cover} alt="" width={32} height={32} />
                            ) : (
                              initials(row.name)
                            )}
                          </span>
                          {row.name}
                        </span>
                        <span className={styles.scoreCell}>
                          <span className={styles.scoreNum}>{row.score}</span>
                          <span className={styles.scoreTrack}>
                            <span className={styles.scoreFill} style={{ width: `${row.score}%` }} />
                          </span>
                        </span>
                        <span>{row.winRate}</span>
                        <span className={styles.games}>{counters.games ?? '—'}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className={styles.rail}>
              {counters?.notes.length ? (
                <div className={styles.railCard}>
                  <div className={styles.railLabel}>HOW {name.toUpperCase()} LOSES</div>
                  <ul>
                    {counters.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Link href={`/counters/${slug}`} className={styles.ctaCard}>
                <div className={styles.ctaTitle}>Counter {name}</div>
                <p className={styles.ctaCopy}>
                  Jump to the three picks we recommend into this lane.
                </p>
              </Link>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}

export function ChampionProfileSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading champion</p>
      <section className={styles.hero}>
        <div className={styles.heroFade} aria-hidden />
        <div className={styles.heroInner}>
          <div className={styles.heroLead}>
            <span data-skel="2" className={`skel-text ${styles.meta}`}>
              FIGHTER · TOP
            </span>
            <span data-skel="1" className={`skel-text ${styles.name}`}>
              VOLIBEAR
            </span>
            <span data-skel="3" className={`skel-text ${styles.meta}`}>
              The Relentless Storm
            </span>
          </div>
        </div>
      </section>
      <section className={styles.body}>
        <MatchupTableSkeleton />
      </section>
    </div>
  );
}

function ChampionBuilds({ slug }: { slug: string }) {
  const items = GEAR_CATALOG.filter((row) => row.kind === 'Items' && row.by.includes(slug));
  const core = items.filter((row) => row.cls !== 'Boots');
  const boots = items.filter((row) => row.cls === 'Boots');
  const runes = GEAR_CATALOG.filter((row) => row.kind === 'Runes' && row.by.includes(slug));

  if (items.length === 0 && runes.length === 0) {
    return (
      <div className={styles.stubPanel}>
        <h2 className={styles.stubTitle}>Core build</h2>
        <p className={styles.stubCopy}>
          No catalog items list {slug} yet. Open the items page for the full handoff set.
        </p>
        <Link href="/items" className={styles.primary} style={{ display: 'inline-flex', alignItems: 'center' }}>
          Open items &amp; runes
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.buildLayout}>
      <div>
        <h2 className={styles.stubTitle}>Core build</h2>
        <p className={styles.stubLead}>
          Items from the design catalog that name this champion. Not a live win-rate build.
        </p>
        <div className={styles.buildList}>
          {core.map((item) => (
            <Link key={item.slug} href="/items" className={styles.buildRow}>
              <Image src={item.icon} alt="" width={52} height={52} className={styles.buildIcon} />
              <span>
                <strong>{item.n}</strong>
                <span className={styles.kitDesc}>{item.passive}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      <aside className={styles.buildRail}>
        <section className={styles.buildCard}>
          <h3 className={styles.buildEyebrow}>Boots</h3>
          {boots.length ? (
            boots.map((item) => (
              <Link key={item.slug} href="/items" className={styles.buildMini}>
                <Image src={item.icon} alt="" width={36} height={36} />
                <span>
                  <strong>{item.n}</strong>
                  <span>{item.cls}</span>
                </span>
              </Link>
            ))
          ) : (
            <p className={styles.stubCopy}>No boots in the catalog for this champion.</p>
          )}
        </section>
        <section className={styles.buildCard}>
          <h3 className={styles.buildEyebrow}>Runes</h3>
          {runes.length ? (
            runes.map((item) => (
              <Link key={item.slug} href="/items" className={styles.buildMini}>
                <Image src={item.icon} alt="" width={36} height={36} />
                <span>
                  <strong>{item.n}</strong>
                  <span>{item.cls}</span>
                </span>
              </Link>
            ))
          ) : (
            <p className={styles.stubCopy}>No runes in the catalog for this champion.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

export function MatchupTableSkeleton({ rows = TABLE_SKEL }: { rows?: readonly string[] }) {
  return (
    <div className={styles.table}>
      <div className={styles.tableHead}>
        <span>#</span>
        <span>CHAMPION</span>
        <span>MATCHUP SCORE</span>
        <span>WIN RATE</span>
        <span>GAMES</span>
      </div>
      {rows.map((width, i) => (
        <div key={width} className={styles.row} aria-hidden>
          <span data-skel="2" className={styles.skelRank} style={{ animationDelay: skeletonDelay(i) }} />
          <span className={styles.champCell}>
            <span data-skel="1" className={styles.skelAvatar} style={{ animationDelay: skeletonDelay(i) }} />
            <span data-skel="2" className={styles.skelName} style={{ width, animationDelay: skeletonDelay(i) }} />
          </span>
          <span className={styles.scoreCell}>
            <span data-skel="2" className={styles.scoreTrack} style={{ animationDelay: skeletonDelay(i) }} />
            <span data-skel="2" className={styles.skelWr} style={{ animationDelay: skeletonDelay(i) }} />
          </span>
          <span data-skel="3" className={styles.skelCell} />
          <span data-skel="3" className={styles.skelCell} />
        </div>
      ))}
    </div>
  );
}
