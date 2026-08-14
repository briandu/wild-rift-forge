import { inferAbilityTags, parseAbilityMarkup, type AbilityMarkupIcon } from '@/lib/ability-markup';
import styles from './AbilityMarkup.module.css';

const ICON_LABEL: Record<AbilityMarkupIcon, string> = {
  ad: 'Attack Damage',
  ap: 'Ability Power',
  health: 'Health',
  armor: 'Armor',
  mr: 'Magic Resist',
};

function StatIcon({ name }: { name: AbilityMarkupIcon }) {
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" aria-label={ICON_LABEL[name]} role="img">
      {name === 'ad' ? (
        <path
          fill="currentColor"
          d="M13.6 1.4 9.2 2.8 8 4l1.2 1.2-6 6-.8 2.4 2.4-.8 6-6L11.8 8l1.2-1.2 1.4-4.4z"
        />
      ) : null}
      {name === 'ap' ? (
        <path
          fill="currentColor"
          d="M8 1.2 9.3 5.4 13.6 6 10 8.8l1.2 4.4L8 11.2 4.8 13.2 6 8.8 2.4 6l4.3-.6z"
        />
      ) : null}
      {name === 'health' ? (
        <>
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 4.6 10.4 8H9v3.4H7V8H5.6z" fill="currentColor" />
        </>
      ) : null}
      {name === 'armor' ? (
        <path
          fill="currentColor"
          d="M8 1.6 13 3.4v4.2c0 3.2-2.1 5.6-5 6.8-2.9-1.2-5-3.6-5-6.8V3.4z"
        />
      ) : null}
      {name === 'mr' ? (
        <path fill="currentColor" d="M8 1.8c2.4 2.2 4.4 4 4.4 6.4A4.4 4.4 0 0 1 8 12.6 4.4 4.4 0 0 1 3.6 8.2C3.6 5.8 5.6 4 8 1.8z" />
      ) : null}
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M3.4 2h9.2v1.4L9.2 7.2 12.6 11v3H3.4v-3l3.4-3.8L3.4 3.4zm2.3 9.4v1.2h4.6v-1.2L8 9.2zM5.7 4.4 8 6.8l2.3-2.4z"
      />
    </svg>
  );
}

const TAG_CLASS: Record<string, string> = {
  passive: styles.tagPassive ?? '',
  physical: styles.tagPhysical ?? '',
  magic: styles.tagMagic ?? '',
  true: styles.tagTrue ?? '',
  heal: styles.tagHeal ?? '',
  shield: styles.tagShield ?? '',
  buff: styles.tagBuff ?? '',
  control: styles.tagControl ?? '',
};

const SEG_CLASS: Record<string, string> = {
  text: styles.text ?? '',
  physical: styles.physical ?? '',
  magic: styles.magic ?? '',
  true: styles.true ?? '',
  heal: styles.heal ?? '',
  shield: styles.shield ?? '',
  cc: styles.cc ?? '',
  ad: styles.ad ?? '',
  ap: styles.ap ?? '',
  health: styles.health ?? '',
  armor: styles.armor ?? '',
  mr: styles.mr ?? '',
  note: styles.note ?? '',
};

export function AbilityMarkup({ text }: { text: string }) {
  const segs = parseAbilityMarkup(text);
  return (
    <span className={styles.root}>
      {segs.map((seg, index) => (
        <span key={`${seg.kind}-${index}`} className={SEG_CLASS[seg.kind] ?? styles.text}>
          {seg.t}
          {seg.icon ? <StatIcon name={seg.icon} /> : null}
        </span>
      ))}
    </span>
  );
}

export function AbilityMeta({
  abilityKey,
  description,
  cooldownLabel,
  className,
}: {
  abilityKey: string;
  description: string;
  cooldownLabel?: string;
  className?: string;
}) {
  const tags = inferAbilityTags(abilityKey, description);
  const [cooldown, ...costParts] = cooldownLabel?.split(' · ') ?? [];
  if (tags.length === 0 && !cooldown) {
    return null;
  }
  return (
    <span className={`${styles.root} ${styles.meta} ${className ?? ''}`}>
      {tags.length > 0 ? (
        <span className={styles.tags}>
          {tags.map((tag) => (
            <span key={tag.label} className={TAG_CLASS[tag.tone]}>
              [{tag.label}]
            </span>
          ))}
        </span>
      ) : null}
      {cooldown ? (
        <span className={styles.cooldown}>
          <HourglassIcon />
          {cooldown}
          {costParts.length > 0 ? <span className={styles.cost}>{costParts.join(' · ')}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
