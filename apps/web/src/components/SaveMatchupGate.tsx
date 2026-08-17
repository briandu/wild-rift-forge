'use client';

import Link from 'next/link';
import { splashFor } from '@/lib/champions';
import { SAVE_GATE_GETS } from '@/lib/draft-copy';
import styles from './SaveMatchupGate.module.css';

export function SaveMatchupGate({
  youName,
  themName,
  themSlug,
  themArt,
  signUpHref,
  signInHref,
  onClose,
}: {
  youName: string;
  themName: string;
  themSlug: string;
  themArt?: string;
  signUpHref: string;
  signInHref: string;
  onClose: () => void;
}) {
  const art = themArt || splashFor(themSlug);
  const pair = `${youName} vs ${themName}`;

  return (
    <div className={styles.layer} role="dialog" aria-modal="true" aria-labelledby="save-gate-title">
      <button type="button" className={styles.backdrop} aria-label="Close" onClick={onClose} />
      <div className={styles.card}>
        <div className={styles.hero}>
          {art ? (
            <div className={styles.heroArt} role="img" aria-label={pair} style={{ backgroundImage: `url(${art})` }} />
          ) : (
            <div className={styles.heroArt} aria-hidden />
          )}
          <div className={styles.heroFade} aria-hidden />
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DEDCEE" strokeWidth="2.4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className={styles.heroCopy}>
            <div className={styles.kicker}>SAVE THIS MATCHUP</div>
            <div id="save-gate-title" className={styles.pair}>
              {pair}
            </div>
          </div>
        </div>
        <div className={styles.body}>
          <p className={styles.lead}>
            Create a free account and this lane stays one tap from your home screen — with everything
            else Forge already does.
          </p>
          <ul className={styles.gets}>
            {SAVE_GATE_GETS.map((item) => (
              <li key={item.k}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8FEDB8" strokeWidth="3" aria-hidden>
                  <path d="M4 12.5l5.2 5.2L20 7" />
                </svg>
                <div>
                  <div className={styles.getK}>{item.k}</div>
                  <div className={styles.getV}>{item.v}</div>
                </div>
              </li>
            ))}
          </ul>
          <Link href={signUpHref} className={styles.cta}>
            Create a free account
          </Link>
          <div className={styles.swap}>
            Already have one?
            <Link href={signInHref}>Sign in</Link>
          </div>
          <p className={styles.fine}>Free forever. No card, and we will bring you straight back here.</p>
        </div>
      </div>
    </div>
  );
}
