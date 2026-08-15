'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { AbilityInfo } from '@/lib/abilities';
import { parseAbilityMentions } from '@/lib/ability-mentions';
import { AbilityMarkup, AbilityMeta } from './AbilityMarkup';
import styles from './AbilityTip.module.css';

export type AbilityTipPayload = {
  id: string;
  slot: string;
  name: string;
  text: string;
  letter: string;
  imageUrl?: string;
  left: number;
  top: number;
  bottom: number;
  above: boolean;
};

type AbilityTipApi = {
  open: (event: MouseEvent<HTMLElement>, tip: Omit<AbilityTipPayload, 'left' | 'top' | 'bottom' | 'above'>) => void;
  toggle: (event: MouseEvent<HTMLElement>, tip: Omit<AbilityTipPayload, 'left' | 'top' | 'bottom' | 'above'>) => void;
  close: () => void;
  current: AbilityTipPayload | null;
};

const AbilityTipContext = createContext<AbilityTipApi | null>(null);

function placeTip(event: MouseEvent<HTMLElement>) {
  const r = event.currentTarget.getBoundingClientRect();
  const width = 278;
  const gap = 12;
  const pad = 12;
  const left = Math.max(pad, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - pad));
  const above = r.top > 190;
  return {
    left: Math.round(left),
    above,
    bottom: Math.round(window.innerHeight - r.top + gap),
    top: Math.round(r.bottom + gap),
  };
}

export function AbilityTipProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<AbilityTipPayload | null>(null);

  const close = useCallback(() => setCurrent(null), []);

  const open = useCallback(
    (event: MouseEvent<HTMLElement>, tip: Omit<AbilityTipPayload, 'left' | 'top' | 'bottom' | 'above'>) => {
      setCurrent({ ...tip, ...placeTip(event) });
    },
    [],
  );

  const toggle = useCallback(
    (event: MouseEvent<HTMLElement>, tip: Omit<AbilityTipPayload, 'left' | 'top' | 'bottom' | 'above'>) => {
      setCurrent((cur) => (cur?.id === tip.id ? null : { ...tip, ...placeTip(event) }));
    },
    [],
  );

  useEffect(() => {
    const drop = () => setCurrent(null);
    window.addEventListener('scroll', drop, true);
    window.addEventListener('resize', drop);
    return () => {
      window.removeEventListener('scroll', drop, true);
      window.removeEventListener('resize', drop);
    };
  }, []);

  const api = useMemo(() => ({ open, toggle, close, current }), [open, toggle, close, current]);

  return (
    <AbilityTipContext.Provider value={api}>
      {children}
      {current ? <AbilityTipOverlay tip={current} /> : null}
    </AbilityTipContext.Provider>
  );
}

export function useAbilityTip() {
  const ctx = useContext(AbilityTipContext);
  if (!ctx) {
    throw new Error('AbilityTip must be used inside AbilityTipProvider');
  }
  return ctx;
}

function AbilityTipOverlay({ tip }: { tip: AbilityTipPayload }) {
  if (typeof document === 'undefined') return null;
  const box = (
    <div
      className={styles.tip}
      style={
        tip.above
          ? { left: tip.left, bottom: tip.bottom }
          : { left: tip.left, top: tip.top }
      }
    >
      <div className={styles.head}>
        {tip.imageUrl ? (
          // Riot CDN icons — skip the Next optimizer so query-string URLs load.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.art} src={tip.imageUrl} alt="" />
        ) : (
          <div className={styles.letter}>{tip.letter}</div>
        )}
        <div>
          <div className={styles.slot}>{tip.slot}</div>
          <div className={styles.name}>{tip.name}</div>
          <AbilityMeta abilityKey={tip.letter} description={tip.text} />
        </div>
      </div>
      <p className={styles.text}>
        <AbilityMarkup text={tip.text} />
      </p>
    </div>
  );
  return createPortal(box, document.body);
}

export function AbilityChip({
  id,
  slot,
  name,
  text,
  letter,
  imageUrl,
  size = 20,
}: {
  id: string;
  slot: string;
  name: string;
  text: string;
  letter: string;
  imageUrl?: string;
  size?: number;
}) {
  const tip = useAbilityTip();
  const payload = { id, slot, name, text, letter, imageUrl };
  const radius = Math.max(4, Math.round(size * 0.28));
  const font = Math.max(9, Math.round(size * 0.48));
  return (
    <span
      className={`${styles.chip} ${imageUrl ? styles.chipArt : styles.chipLetter}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: font,
        lineHeight: `${size}px`,
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
      }}
      onMouseEnter={(event) => tip.open(event, payload)}
      onMouseLeave={tip.close}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        tip.toggle(event, payload);
      }}
      role="button"
      tabIndex={0}
      aria-label={`${slot}: ${name}`}
    >
      {imageUrl ? <span className={styles.chipKey}>{letter}</span> : letter}
    </span>
  );
}

export function AbilityRichText({
  text,
  id,
  you,
  them,
  kits,
  size = 18,
}: {
  text: string;
  id?: string;
  you: string;
  them: string;
  kits: Record<string, AbilityInfo[]>;
  size?: number;
}) {
  const reactId = useId();
  const segs = parseAbilityMentions(text, id ?? reactId, { you, them, def: them, kits });
  if (segs.length === 1 && segs[0]?.kind === 'text') {
    return <>{text}</>;
  }
  return (
    <>
      {segs.map((seg, index) =>
        seg.kind === 'text' ? (
          <span key={`t${index}`}>
            <AbilityMarkup text={seg.t} />
          </span>
        ) : (
          <span key={seg.id}>
            <AbilityChip
              id={seg.id}
              slot={seg.slot}
              name={seg.name}
              text={seg.text}
              letter={seg.key}
              imageUrl={seg.imageUrl}
              size={size}
            />
            {seg.label ? seg.label : null}
          </span>
        ),
      )}
    </>
  );
}
