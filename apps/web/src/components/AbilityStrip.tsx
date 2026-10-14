'use client';

import Image from '@/components/Image';
import { useState } from 'react';
import type { AbilityInfo } from '@/lib/abilities';
import { omitStorageUrl } from '@/lib/storage-image';
import { AbilityMarkup, AbilityMeta } from './AbilityMarkup';
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
  if (abilities.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.root} ${overlay ? styles.overlay : ''}`}>
      <div className={styles.icons} role="list">
        {abilities.map((ability, i) => {
          const selected = i === active;
          const icon = omitStorageUrl(ability.imageUrl);
          return (
            <button
              key={ability.key}
              type="button"
              role="listitem"
              className={`${styles.icon} ${size === 'lg' ? styles.iconLg : ''} ${selected ? styles.iconActive : ''}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={`${ability.key}: ${ability.name}`}
            >
              {icon ? (
                icon.startsWith('http') ? (
                  // Riot CDN icons — skip the Next optimizer so query-string Sanity URLs load.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={icon} alt="" />
                ) : (
                  <Image
                    src={icon}
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
          <AbilityMeta
            abilityKey={current.key}
            description={current.description}
            cooldownLabel={current.cooldownLabel}
            className={styles.hint}
          />
          <p className={styles.desc}>
            <AbilityMarkup text={current.description} />
          </p>
        </div>
      ) : null}
    </div>
  );
}
