'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { AbilityInfo } from '@/lib/abilities';
import styles from './AbilityStrip.module.css';

export function AbilityStrip({
  abilities,
  size = 'md',
  overlay = false,
}: {
  abilities: AbilityInfo[];
  size?: 'md' | 'lg';
  overlay?: boolean;
}) {
  const [active, setActive] = useState(0);
  const current = abilities[active] ?? abilities[0];

  return (
    <div className={`${styles.root} ${overlay ? styles.overlay : ''}`}>
      <div className={styles.icons} role="list">
        {abilities.map((ability, i) => {
          const selected = i === active;
          return (
            <button
              key={ability.key}
              type="button"
              role="listitem"
              className={`${styles.icon} ${size === 'lg' ? styles.iconLg : ''} ${selected ? styles.iconActive : ''}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              aria-label={`${ability.key}: ${ability.name}`}
            >
              {ability.imageUrl ? (
                ability.imageUrl.startsWith('http') ? (
                  // Riot CDN icons — skip the Next optimizer so query-string Sanity URLs load.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ability.imageUrl} alt="" />
                ) : (
                  <Image
                    src={ability.imageUrl}
                    alt=""
                    width={size === 'lg' ? 66 : 52}
                    height={size === 'lg' ? 66 : 52}
                  />
                )
              ) : (
                <span className={styles.placeholder}>{ability.key}</span>
              )}
            </button>
          );
        })}
      </div>
      {current ? (
        <div className={styles.detail}>
          <div className={styles.detailHead}>
            <span className={styles.key}>{current.key}</span>
            <span className={styles.name}>{current.name}</span>
          </div>
          <p className={styles.hint}>Hover an ability for details</p>
          <p className={styles.desc}>{current.description}</p>
        </div>
      ) : null}
    </div>
  );
}
