'use client';

import type { AbilityInfo } from '@/lib/abilities';
import { abilitySlotLabel } from '@/lib/ability-mentions';
import { AbilityChip } from './AbilityTip';
import styles from './SkillOrder.module.css';

const LEVELS = Array.from({ length: 15 }, (_, i) => i + 1);
const GRID_KEYS = ['Q', 'W', 'E', 'R'] as const;

export function SkillOrder({
  name,
  abilities,
}: {
  name: string;
  abilities: AbilityInfo[];
}) {
  const basics = GRID_KEYS.map((key) => abilities.find((row) => row.key === key)).filter(
    (row): row is AbilityInfo => Boolean(row),
  );
  const early = basics.slice(0, 3);

  if (basics.length === 0) {
    return (
      <p className={styles.need}>Kit fills in when abilities are scraped.</p>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <section className={styles.card}>
          <h2 className={styles.eyebrow}>Max order</h2>
          <div className={styles.maxRow}>
            {basics.slice(0, 3).map((ability, index) => (
              <div key={ability.key} className={styles.maxStep}>
                <AbilityChip
                  id={`max-${ability.key}`}
                  slot={`${name.toUpperCase()} · ${abilitySlotLabel(ability.key)}`}
                  name={ability.name}
                  text={ability.description || `${name}'s ${ability.key} has not been written up yet.`}
                  letter={ability.key}
                  imageUrl={ability.imageUrl}
                  size={52}
                />
                {index < 2 ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A4560" strokeWidth="2.4" aria-hidden>
                    <path d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                ) : null}
              </div>
            ))}
          </div>
          <p className={styles.note}>
            These are the basic abilities in kit order, not a recommended max. Point-by-point
            orders land when we have a skill-order source.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.eyebrow}>Levelling grid</h2>
          <div className={styles.gridWrap}>
            <div className={styles.levelHead}>
              {LEVELS.map((level) => (
                <span key={level}>{level}</span>
              ))}
            </div>
            {basics.map((ability) => (
              <div key={ability.key} className={styles.gridRow}>
                <AbilityChip
                  id={`grid-${ability.key}`}
                  slot={`${name.toUpperCase()} · ${abilitySlotLabel(ability.key)}`}
                  name={ability.name}
                  text={ability.description || `${name}'s ${ability.key} has not been written up yet.`}
                  letter={ability.key}
                  imageUrl={ability.imageUrl}
                  size={24}
                />
                {LEVELS.map((level) => (
                  <span key={level} className={styles.cell} />
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className={styles.rail}>
        <section className={styles.card}>
          <h2 className={styles.eyebrow}>First three levels</h2>
          {early.map((ability, index) => (
            <div key={ability.key} className={styles.early}>
              <AbilityChip
                id={`early-${ability.key}`}
                slot={`${name.toUpperCase()} · ${abilitySlotLabel(ability.key)}`}
                name={ability.name}
                text={ability.description || `${name}'s ${ability.key} has not been written up yet.`}
                letter={ability.key}
                imageUrl={ability.imageUrl}
                size={38}
              />
              <div>
                <div className={styles.earlyLvl}>Level {index + 1}</div>
                <p className={styles.earlyWhy}>
                  {ability.name} — inspect the kit. We will not invent which point to take first.
                </p>
              </div>
            </div>
          ))}
        </section>
      </aside>
    </div>
  );
}
