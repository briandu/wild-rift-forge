'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { LatestPatchResponse } from '@/lib/api-types';
import { abilitySlotLabel } from '@/lib/ability-mentions';
import { AbilityChip } from './AbilityTip';
import { ChampFace } from './ChampFace';
import styles from './PatchNotes.module.css';

const FILTERS = ['All', 'Buffs', 'Nerfs', 'Adjusted'] as const;
const FILTER_MAP = { Buffs: 'BUFF', Nerfs: 'NERF', Adjusted: 'ADJUST' } as const;

function kindStyle(kind: string): [string, string, string] {
  if (kind === 'BUFF') return ['#8FEDB8', 'rgba(123,224,168,.14)', 'rgba(123,224,168,.38)'];
  if (kind === 'NERF') return ['#E58B7B', 'rgba(229,139,123,.14)', 'rgba(229,139,123,.38)'];
  return ['#9FCBE4', 'rgba(255,255,255,.07)', 'rgba(255,255,255,.18)'];
}

function groupLinesByAbility<T extends { k: string }>(lines: T[]): Array<{ k: string; lines: T[] }> {
  const groups: Array<{ k: string; lines: T[] }> = [];
  const indexByKey = new Map<string, number>();
  for (const line of lines) {
    const existing = indexByKey.get(line.k);
    if (existing !== undefined) {
      groups[existing]!.lines.push(line);
      continue;
    }
    indexByKey.set(line.k, groups.length);
    groups.push({ k: line.k, lines: [line] });
  }
  return groups;
}

function formatEyebrow(iso: string | null): string {
  if (!iso) {
    return 'LATEST PATCH';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'LATEST PATCH';
  }
  return `LIVE SINCE ${date.getUTCDate()} ${date
    .toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
    .toUpperCase()}`;
}

export function PatchNotes({
  portraits = {},
  data,
}: {
  portraits?: Record<string, string>;
  data: LatestPatchResponse | null;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [rebuildOn, setRebuildOn] = useState(Boolean(data?.rebuilding));

  const champions = data?.champions ?? [];
  const list = useMemo(() => {
    const filtered =
      filter === 'All' ? champions : champions.filter((c) => c.kind === FILTER_MAP[filter]);
    return [...filtered].sort((a, b) => Math.abs(b.wrShift ?? 0) - Math.abs(a.wrShift ?? 0));
  }, [champions, filter]);

  const movers = data?.analysis?.movers?.slice(0, 4) ?? [];
  const buffs = champions.filter((c) => c.kind === 'BUFF').length;
  const nerfs = champions.filter((c) => c.kind === 'NERF').length;
  const version = data?.patch.version ?? '—';
  const lede =
    data?.analysis?.lede ??
    'Patch notes are in. Commentary appears after the next ingest when OPENAI_API_KEY is set.';
  const items = data?.items ?? [];
  const nameOf = (slug: string) =>
    champions.find((row) => row.slug === slug)?.name ?? slug.replace(/-/g, ' ');
  const watchFaces = (data?.analysis?.watch ?? champions.slice(0, 4)).map((row) =>
    'why' in row ? { name: nameOf(row.slug), slug: row.slug } : { name: row.name, slug: row.slug },
  );

  return (
    <div>
      <div className={styles.hero}>
        <div className={styles.glow} aria-hidden />

        {rebuildOn ? (
          <div className={styles.rebuild}>
            <div className={styles.rebuildFaces}>
              {watchFaces.map((row) => (
                <ChampFace
                  key={row.slug}
                  name={row.name}
                  slug={row.slug}
                  size={34}
                  round="soft"
                  portraits={portraits}
                />
              ))}
            </div>
            <div className={styles.rebuildCopy}>
              <div className={styles.rebuildTitle}>Matchup data is rebuilding</div>
              <p>
                Counter scores for the changed champions are recalculating. Tier bands use the
                latest Diamond+ snapshot
                {data?.statsAsOf ? ` (${data.statsAsOf})` : ''}.
              </p>
            </div>
            <button type="button" className={styles.gotIt} onClick={() => setRebuildOn(false)}>
              Got it
            </button>
          </div>
        ) : null}

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{formatEyebrow(data?.patch.releaseDate ?? null)}</p>
            <h1 className={styles.title}>Patch {version}</h1>
            <p className={styles.lede}>{lede}</p>
          </div>
          <div className={styles.stats}>
            <div>
              <div className={styles.statValue}>{champions.length}</div>
              <div className={styles.statLabel}>CHAMPIONS CHANGED</div>
            </div>
            <div>
              <div className={styles.statValue} style={{ color: 'var(--success)' }}>
                {buffs}
              </div>
              <div className={styles.statLabel}>BUFFED</div>
            </div>
            <div>
              <div className={styles.statValue} style={{ color: 'var(--danger)' }}>
                {nerfs}
              </div>
              <div className={styles.statLabel}>NERFED</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.main}>
          <div className={styles.toolbar}>
            <div className={`${styles.filters} xfade`}>
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={filter === f ? styles.filterActive : styles.filter}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className={styles.count}>
              {list.length} of {champions.length} shown
            </div>
          </div>

          <div className={styles.list}>
            {list.length === 0 ? (
              <div className={styles.count}>No patch notes stored yet.</div>
            ) : (
              list.map((c) => {
                const [kindc, kindbg, kindbd] = kindStyle(c.kind);
                const shift = c.wrShift;
                const delta = shift === null ? '—' : `${shift > 0 ? '+' : ''}${shift.toFixed(1)}`;
                const deltac =
                  shift === null
                    ? '#9FCBE4'
                    : shift > 0
                      ? '#8FEDB8'
                      : shift < 0
                        ? '#E58B7B'
                        : '#9FCBE4';
                return (
                  <Link key={c.slug} href={`/champions/${c.slug}`} className={styles.card}>
                    <ChampFace
                      name={c.name}
                      slug={c.slug}
                      size={64}
                      round="soft"
                      portraits={portraits}
                    />
                    <div className={styles.cardBody}>
                      <div className={styles.cardHead}>
                        <span className={styles.cardName}>{c.name}</span>
                        <span
                          className={styles.kind}
                          style={{ color: kindc, background: kindbg, borderColor: kindbd }}
                        >
                          {c.kind}
                        </span>
                      </div>
                      <div className={styles.lines}>
                        {groupLinesByAbility(c.lines).map((group) => {
                          const ability = c.abilities?.find((item) => item.key === group.k);
                          const first = group.lines[0]!;
                          return (
                            <div
                              key={group.k}
                              className={
                                group.lines.length > 1
                                  ? `${styles.line} ${styles.lineStack}`
                                  : styles.line
                              }
                            >
                              <AbilityChip
                                id={`patch-${c.name}-${group.k}`}
                                slot={`${c.name.toUpperCase()} · ${abilitySlotLabel(group.k)}`}
                                name={ability?.name ?? (group.k === 'P' ? 'Passive' : group.k)}
                                text={
                                  ability?.description ||
                                  group.lines.map((line) => line.t).join(' ')
                                }
                                letter={group.k}
                                imageUrl={ability?.imageUrl ?? first.imageUrl}
                                size={26}
                              />
                              <div className={styles.lineTexts}>
                                {group.lines.map((line) => (
                                  <span key={`${line.k}-${line.t}`}>{line.t}</span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className={styles.deltaCol}>
                      <div className={styles.delta} style={{ color: deltac }}>
                        {delta}
                      </div>
                      <div className={styles.deltaLabel}>
                        {shift === null ? 'WIN RATE' : 'WIN RATE SHIFT'}
                      </div>
                      <div className={styles.nowRow}>
                        <span>{c.wr ? `now ${c.wr}` : 'awaiting snapshot'}</span>
                        {shift !== null ? (
                          <span className={styles.deltaTrack}>
                            <span
                              className={styles.deltaFill}
                              style={{
                                width: `${Math.min(100, Math.abs(shift) * 40)}%`,
                                background: deltac,
                              }}
                            />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <aside className={styles.rail}>
          <div className={styles.railCard}>
            <div className={styles.railLabel}>BIGGEST MOVERS</div>
            {movers.length === 0 ? (
              <div className={styles.itemRow}>Commentary movers appear after patch analysis.</div>
            ) : (
              movers.map((mover) => (
                <Link key={mover.slug} href={`/champions/${mover.slug}`} className={styles.mover}>
                  <ChampFace
                    name={nameOf(mover.slug)}
                    slug={mover.slug}
                    size={34}
                    round="soft"
                    portraits={portraits}
                  />
                  <div className={styles.moverCopy}>
                    <div className={styles.moverName}>{nameOf(mover.slug)}</div>
                    <div className={styles.moverNote}>{mover.note}</div>
                  </div>
                  <div
                    className={styles.moverDelta}
                    style={{ color: mover.direction === 'up' ? '#8FEDB8' : '#E58B7B' }}
                  >
                    {mover.direction === 'up' ? 'UP' : 'DOWN'}
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className={styles.railCard}>
            <div className={styles.railLabel}>ITEMS</div>
            {items.length === 0 ? (
              <div className={styles.itemRow}>No item changes in this patch.</div>
            ) : (
              items.map((item) => (
                <div key={item} className={styles.itemRow}>
                  <span className={styles.itemDot} />
                  <span>{item}</span>
                </div>
              ))
            )}
          </div>

          <Link href="/draft" className={styles.draftCta}>
            <div className={styles.draftTitle}>Draft with the new numbers</div>
            <div className={styles.draftCopy}>
              Suggestions will use {version} matchup data once counters are live.
            </div>
          </Link>
        </aside>
      </div>
    </div>
  );
}
