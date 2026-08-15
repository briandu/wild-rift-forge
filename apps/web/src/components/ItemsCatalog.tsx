'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ART_BY_SLUG, HERO_FALLBACK, initials } from '@/lib/champions';
import {
  GEAR_CATALOG,
  ITEM_CLASSES,
  RUNE_CLASSES,
  gearFor,
  monogram,
  type GearEntry,
  type GearKind,
} from '@/lib/gear-catalog';
import { EmptyPanel, emptyCtaClass } from './LoadState';
import styles from './ItemsCatalog.module.css';

const TABS: GearKind[] = ['Items', 'Runes'];

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ItemsCatalog({
  patchVersion,
  portraits = {},
}: {
  patchVersion: string | null;
  portraits?: Record<string, string>;
}) {
  const [tab, setTab] = useState<GearKind>('Items');
  const [klass, setKlass] = useState('All');
  const filters = tab === 'Items' ? ITEM_CLASSES : RUNE_CLASSES;
  const activeClass = (filters as readonly string[]).includes(klass) ? klass : 'All';
  const rows = useMemo(() => gearFor(tab, activeClass), [tab, activeClass]);
  const [sel, setSel] = useState(rows[0]?.slug ?? GEAR_CATALOG[0]!.slug);
  const selected = rows.find((row) => row.slug === sel) ?? rows[0] ?? null;
  const noun = tab.toLowerCase();
  const total = GEAR_CATALOG.filter((row) => row.kind === tab).length;

  return (
    <div>
      <div className={styles.hero}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.heroInner}>
          <div>
            <p className={styles.eyebrow}>
              {patchVersion ? `PATCH ${patchVersion}` : 'CURRENT PATCH'}
            </p>
            <h1 className={styles.title}>Items &amp; runes</h1>
            <p className={styles.copy}>
              The catalog from the current design handoff. Stats and passives are reference copy;
              win rates stay off until a build source is wired.
            </p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Catalog">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                className={tab === name ? styles.tabOn : styles.tab}
                onClick={() => {
                  setTab(name);
                  setKlass('All');
                  const next = gearFor(name, 'All')[0];
                  if (next) setSel(next.slug);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.classes} role="group" aria-label={`${tab} class`}>
          {filters.map((name) => (
            <button
              key={name}
              type="button"
              className={activeClass === name ? styles.classOn : styles.classBtn}
              onClick={() => {
                setKlass(name);
                const next = gearFor(tab, name)[0];
                if (next) setSel(next.slug);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <p className={styles.count}>
          {rows.length} of {total} {noun}
        </p>
      </div>

      <div className={styles.cols}>
        <div className={styles.grid}>
          {rows.length === 0 ? (
            <EmptyPanel
              title="Nothing in that category this patch."
              copy="Try another class, or browse the champion roster."
              action={
                <Link href="/champions" className={emptyCtaClass()}>
                  Browse champions
                </Link>
              }
            />
          ) : (
            rows.map((row) => (
              <button
                key={row.slug}
                type="button"
                className={selected?.slug === row.slug ? styles.cardOn : styles.card}
                onClick={() => setSel(row.slug)}
              >
                <GearIcon entry={row} size={50} />
                <span className={styles.cardCopy}>
                  <span className={styles.cardName}>{row.n}</span>
                  <span className={styles.cardMeta}>
                    {row.cost ? `${row.cls} · ${row.cost}g` : row.cls}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        {selected ? <GearRail entry={selected} portraits={portraits} /> : null}
      </div>
    </div>
  );
}

function GearIcon({ entry, size }: { entry: GearEntry; size: number }) {
  return (
    <span
      className={entry.kind === 'Runes' ? styles.iconRound : styles.icon}
      style={{ width: size, height: size }}
    >
      <Image src={entry.icon} alt="" width={size} height={size} />
      <span className="sr-only">{monogram(entry.n)}</span>
    </span>
  );
}

function GearRail({
  entry,
  portraits,
}: {
  entry: GearEntry;
  portraits: Record<string, string>;
}) {
  return (
    <aside className={styles.rail}>
      <div className={styles.railHead}>
        <GearIcon entry={entry} size={64} />
        <div>
          <h2 className={styles.railName}>{entry.n}</h2>
          <p className={styles.railMeta}>
            {entry.cls}
            {entry.cost ? ` · ${entry.cost}g` : ''}
          </p>
        </div>
      </div>
      <div className={styles.railBlock}>
        <h3 className={styles.railEyebrow}>Stats</h3>
        {entry.stats.map((stat) => (
          <p key={stat} className={styles.railLine}>
            {stat}
          </p>
        ))}
      </div>
      <div className={styles.railBlock}>
        <h3 className={styles.railEyebrow}>Passive</h3>
        <p className={styles.railLine}>{entry.passive}</p>
      </div>
      <div className={styles.railBlock}>
        <h3 className={styles.railEyebrow}>Built most by</h3>
        <div className={styles.by}>
          {entry.by.map((slug) => {
            const art = portraits[slug] || ART_BY_SLUG[slug] || HERO_FALLBACK;
            const name = titleCase(slug);
            return (
              <Link key={slug} href={`/champions/${slug}`} className={styles.byChamp}>
                <span className={styles.byFace}>
                  {art ? (
                    <Image src={art} alt="" width={64} height={64} />
                  ) : (
                    initials(name)
                  )}
                </span>
                <span>{name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export function ItemsCatalogSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading items and runes</p>
      <div className={styles.hero}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.heroInner}>
          <div>
            <span data-skel="2" className={`skel-text ${styles.eyebrow}`}>
              CURRENT PATCH
            </span>
            <span data-skel="1" className={`skel-text ${styles.title}`}>
              Items &amp; runes
            </span>
            <span data-skel="3" className={`skel-text ${styles.copy}`}>
              The catalog from the current design handoff.
            </span>
          </div>
        </div>
      </div>
      <div className={styles.cols}>
        <div className={styles.skelGrid}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={styles.skelCard} data-skel="2" />
          ))}
        </div>
      </div>
    </div>
  );
}
