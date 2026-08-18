'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef } from 'react';
import type { ApiChampion } from '@/lib/api';
import { phaseLabel } from '@wild-rift-forge/vision';
import { toIconReferences } from '@/lib/capture/to-draft-state';
import { useDraftCapture } from '@/lib/capture/use-draft-capture';
import type { IconSignatureDto } from '@/lib/api-types';
import type { DraftState } from '@/lib/draft-state';
import styles from './DraftCaptureBar.module.css';

const SLOT_LABELS: Record<string, string> = {
  ally: 'Your team',
  enemy: 'Enemy',
  'ban-ally': 'Your ban',
  'ban-enemy': 'Enemy ban',
};

export function DraftCaptureBar({
  signatures,
  champions,
  portraits,
  state,
  onRead,
  onScanning,
  resetToken = 0,
}: {
  signatures: IconSignatureDto[];
  champions: ApiChampion[];
  portraits: Record<string, string>;
  state: DraftState;
  onRead: (next: DraftState) => void;
  onScanning?: (scanning: boolean) => void;
  resetToken?: number;
}) {
  const references = useMemo(() => toIconReferences(signatures), [signatures]);
  const { status, error, lastRead, arm, disarm, capture, calibrate } = useDraftCapture(references);

  const armed = status === 'armed' || status === 'reading';
  const busy = status === 'reading' || status === 'arming';
  const stateRef = useRef(state);
  stateRef.current = state;
  const applyGen = useRef(0);

  function applyIfCurrent(gen: number, next: DraftState | undefined) {
    if (gen !== applyGen.current || !next) return;
    onRead(next);
  }

  useEffect(() => {
    applyGen.current += 1;
    disarm();
    onScanning?.(false);
  }, [resetToken, disarm, onScanning]);

  useEffect(() => {
    onScanning?.(armed || busy);
  }, [armed, busy, onScanning]);

  useEffect(() => {
    if (!armed) return;
    const tick = window.setInterval(() => {
      const gen = applyGen.current;
      void capture(stateRef.current).then((applied) => applyIfCurrent(gen, applied?.state));
    }, 900);
    return () => window.clearInterval(tick);
  }, [armed, capture, onRead]);

  // One keypress to re-read, since champion select does not leave time to aim a mouse.

  useEffect(() => {
    if (!armed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'r' && event.key !== 'R') return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      const gen = applyGen.current;
      void capture(state).then((applied) => applyIfCurrent(gen, applied?.state));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armed, capture, onRead, state]);

  if (status === 'unsupported') {
    return (
      <div className={styles.bar}>
        <span className={styles.note}>
          Screen capture needs a desktop browser. The board below works by hand everywhere.
        </span>
      </div>
    );
  }

  const nameFor = (slug: string | null) =>
    (slug && champions.find((row) => row.slug === slug)?.name) || slug || 'Unknown';

  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        <span className={`${styles.dot} ${armed ? styles.dotLive : ''}`} />
        <span className={styles.title}>
          {armed ? 'Reading your screen' : 'Read the draft off your screen'}
        </span>

        {!armed ? (
          <button type="button" className={styles.primary} onClick={() => void arm()} disabled={busy}>
            {status === 'arming' ? 'Waiting for share…' : 'Share screen'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => {
                const gen = applyGen.current;
                void capture(state).then((applied) => applyIfCurrent(gen, applied?.state));
              }}
            >
              {status === 'reading' ? 'Reading…' : 'Capture now'}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={() => void calibrate()}
              title="Run this once on a champion-select screen to lock the layout"
            >
              Calibrate
            </button>
            <button type="button" className={styles.secondary} onClick={disarm}>
              Stop
            </button>
            <kbd className={styles.kbd}>R</kbd>
          </>
        )}

        {!signatures.length ? (
          <span className={styles.warn}>Champion reference data is not loaded yet.</span>
        ) : null}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {busy && !lastRead ? (
        <p className={styles.note}>Reading the shared screen…</p>
      ) : lastRead ? (
        <p className={styles.note}>
          {busy ? 'Reading… ' : ''}
          {lastRead.phase !== 'unknown' ? `${phaseLabel(lastRead.phase)}. ` : ''}
          Read {lastRead.resolved} slot{lastRead.resolved === 1 ? '' : 's'}.
          {lastRead.review.length
            ? ` ${lastRead.review.length} need${lastRead.review.length === 1 ? 's' : ''} a look.`
            : ' Everything looked clean.'}
        </p>
      ) : (
        <p className={styles.note}>
          Share the window running Wild Rift, then capture during champion select. Frames stay on
          your device.
        </p>
      )}

      {lastRead?.review.length ? (
        <div className={styles.review}>
          {lastRead.review.map((slot) => {
            const art = slot.candidate ? portraits[slot.candidate] : undefined;
            return (
              <div key={slot.key} className={styles.reviewItem}>
                <span className={styles.reviewArt}>
                  {art ? <Image src={art} alt="" width={28} height={28} /> : '?'}
                </span>
                <span className={styles.reviewText}>
                  <strong>{nameFor(slot.candidate)}</strong>
                  <span className={styles.reviewSlot}>
                    {SLOT_LABELS[slot.role] ?? slot.role} {slot.index + 1} ·{' '}
                    {Math.round(slot.confidence * 100)}%
                  </span>
                </span>
              </div>
            );
          })}
          <span className={styles.reviewHint}>Tap a slot below to correct it.</span>
        </div>
      ) : null}
    </div>
  );
}
