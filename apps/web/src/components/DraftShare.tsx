'use client';

import { useState } from 'react';
import styles from './DraftShare.module.css';

export function DraftShare({
  link,
  watchers = 0,
  signedIn,
  sheet = false,
  onClose,
}: {
  link: string | null;
  watchers?: number;
  signedIn: boolean;
  sheet?: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={sheet ? styles.sheet : styles.pop} role="dialog" aria-label="Spectator link">
      {sheet ? <div className={styles.grip} /> : null}
      <div className={styles.title}>Spectator link</div>
      <p className={styles.copy}>
        Read-only. Friends see the board update as picks land, with no ability to change it.
      </p>
      {signedIn && link ? (
        <div className={styles.row}>
          <div className={styles.link}>{link}</div>
          {copied ? (
            <span className={styles.copied}>Copied</span>
          ) : (
            <button type="button" className={styles.copyBtn} onClick={() => void copy()}>
              Copy
            </button>
          )}
        </div>
      ) : (
        <p className={styles.copy}>Sign in to mint a link friends can open.</p>
      )}
      <div className={styles.foot}>
        <span className={styles.watchDot} />
        <span className={styles.watch}>{watchers} watching</span>
        <button type="button" className={styles.close} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
