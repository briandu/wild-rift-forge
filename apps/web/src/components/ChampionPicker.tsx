'use client';

import Fuse, { type IFuseOptions } from 'fuse.js';
import { useEffect, useMemo, useState } from 'react';
import type { ApiChampion } from '@/lib/api';
import { ChampFace } from './ChampFace';
import styles from './ChampionPicker.module.css';

const FUSE_OPTIONS: IFuseOptions<ApiChampion> = {
  keys: [
    { name: 'name', weight: 2 },
    { name: 'slug', weight: 1 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
};

export function ChampionPicker({
  open,
  kicker,
  title,
  note,
  champions,
  portraits,
  exclude = [],
  onPick,
  onClose,
}: {
  open: boolean;
  kicker?: string;
  title: string;
  note?: string;
  champions: ApiChampion[];
  portraits: Record<string, string>;
  exclude?: string[];
  onPick: (champion: ApiChampion) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const blocked = useMemo(() => new Set(exclude), [exclude]);
  const fuse = useMemo(() => new Fuse(champions, FUSE_OPTIONS), [champions]);
  const list = useMemo(() => {
    const q = query.trim();
    const source = q ? fuse.search(q, { limit: 40 }).map((hit) => hit.item) : champions;
    return source.filter((champion) => !blocked.has(champion.slug)).slice(0, 80);
  }, [blocked, champions, fuse, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className={styles.scrim} onClick={onClose} aria-label="Close" />
      <div className={styles.panel}>
        <div className={styles.head}>
          <div>
            {kicker ? <div className={styles.kicker}>{kicker}</div> : null}
            <h2 className={styles.title}>{title}</h2>
            {note ? <p className={styles.note}>{note}</p> : null}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <input
          className={styles.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search champions"
          autoFocus
        />
        <div className={styles.grid}>
          {list.map((champion) => (
            <button
              key={champion.slug}
              type="button"
              className={styles.cell}
              onClick={() => {
                onPick(champion);
                onClose();
              }}
            >
              <ChampFace name={champion.name} slug={champion.slug} size={52} portraits={portraits} />
              <span>{champion.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}