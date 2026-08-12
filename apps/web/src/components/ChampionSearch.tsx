'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';
import type { ApiChampion } from '@/lib/api';
import { initials, roleLabel } from '@/lib/champions';
import styles from './ChampionSearch.module.css';

export function ChampionSearch({
  champions,
  variant = 'hero',
}: {
  champions: ApiChampion[];
  variant?: 'hero' | 'compact';
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  const results = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return [];
    return champions
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [champions, deferred]);

  function go(slug: string) {
    router.push(`/counters/${slug}`);
    setQuery('');
  }

  function onSubmit() {
    const first = results[0];
    if (first) go(first.slug);
  }

  return (
    <div className={variant === 'hero' ? styles.heroWrap : styles.compactWrap}>
      <div className={variant === 'hero' ? styles.heroBar : styles.compactBar}>
        <svg
          width={variant === 'hero' ? 19 : 15}
          height={variant === 'hero' ? 19 : 15}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent-soft)"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
          placeholder={variant === 'hero' ? 'Search champion…' : 'Search champion'}
          aria-label="Search champion"
          className={styles.input}
        />
        {variant === 'hero' ? (
          <button type="button" className={`${styles.cta} animate-cta`} onClick={onSubmit}>
            Counter
          </button>
        ) : null}
      </div>

      {results.length > 0 ? (
        <ul className={styles.results} role="listbox">
          {results.map((c, i) => (
            <li key={c.slug}>
              <button
                type="button"
                className={i === 0 ? styles.resultActive : styles.result}
                onClick={() => go(c.slug)}
              >
                <span className={styles.avatar}>
                  {c.imageUrl ? (
                    <Image src={c.imageUrl} alt="" width={38} height={38} />
                  ) : (
                    <span>{initials(c.name)}</span>
                  )}
                </span>
                <span className={styles.name}>{c.name}</span>
                {variant === 'hero' ? (
                  <span className={styles.meta}>{roleLabel(c.roles)}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
