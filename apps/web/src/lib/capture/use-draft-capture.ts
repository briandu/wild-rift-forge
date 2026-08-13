'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  aspectKey,
  calibrateLayout,
  readDraft,
  type IconReference,
  type LayoutProfile,
} from '@wild-rift-forge/vision';
import {
  armCapture,
  CaptureError,
  grabFrame,
  isCaptureSupported,
  onCaptureEnded,
  stopCapture,
  type CaptureSession,
} from './screen';
import { applyRead, type AppliedRead } from './to-draft-state';
import type { DraftState } from '../draft-state';

export type CaptureStatus = 'idle' | 'arming' | 'armed' | 'reading' | 'unsupported';

const PROFILE_KEY = 'wrf.capture.profiles.v1';

/**
 * Calibrated layouts are cached per aspect ratio, so a user who always shares the
 * same emulator window pays the calibration cost once.
 */
function loadProfiles(): Record<string, LayoutProfile> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LayoutProfile>) : {};
  } catch {
    return {};
  }
}

function saveProfile(profile: LayoutProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const all = loadProfiles();
    all[profile.aspectKey] = profile;
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
  } catch {
    // Losing the cache only costs a recalibration.
  }
}

export type UseDraftCapture = {
  status: CaptureStatus;
  error: string | null;
  /** Result of the most recent read, or null before the first capture. */
  lastRead: AppliedRead | null;
  arm: () => Promise<void>;
  disarm: () => void;
  capture: (previous?: DraftState) => Promise<AppliedRead | null>;
  calibrate: () => Promise<boolean>;
};

/**
 * Screen capture for the draft board.
 *
 * Recognition runs synchronously in the page: a frame grab plus a hash lookup per
 * slot is a few milliseconds, so there is no worker or server round-trip to wait on.
 * Every failure path leaves the manual board fully usable.
 */
export function useDraftCapture(references: readonly IconReference[]): UseDraftCapture {
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<AppliedRead | null>(null);
  const sessionRef = useRef<CaptureSession | null>(null);
  const detachRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isCaptureSupported()) setStatus('unsupported');
  }, []);

  const teardown = useCallback(() => {
    detachRef.current?.();
    detachRef.current = null;
    stopCapture(sessionRef.current);
    sessionRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const arm = useCallback(async () => {
    if (sessionRef.current) return;
    setError(null);
    setStatus('arming');
    try {
      const session = await armCapture();
      sessionRef.current = session;
      // The browser's own "Stop sharing" bar bypasses our UI entirely.
      detachRef.current = onCaptureEnded(session, () => {
        teardown();
        setStatus('idle');
      });
      setStatus('armed');
    } catch (err) {
      const reason = err instanceof CaptureError ? err.reason : null;
      setStatus(reason === 'unsupported' ? 'unsupported' : 'idle');
      setError(err instanceof Error ? err.message : 'Could not start screen sharing.');
    }
  }, [teardown]);

  const disarm = useCallback(() => {
    teardown();
    setStatus('idle');
    setError(null);
  }, [teardown]);

  const capture = useCallback(
    async (previous?: DraftState) => {
      const session = sessionRef.current;
      if (!session) {
        setError('Start screen sharing first.');
        return null;
      }
      setStatus('reading');
      setError(null);
      try {
        const frame = grabFrame(session);
        const profile = loadProfiles()[aspectKey(frame.width, frame.height)];
        const read = readDraft(frame, references, { profile });
        const applied = applyRead(read, previous);
        setLastRead(applied);
        if (applied.resolved === 0) {
          setError('No champions recognised. Try calibrating on a champion-select screen.');
        }
        return applied;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not read the screen.');
        return null;
      } finally {
        setStatus(sessionRef.current ? 'armed' : 'idle');
      }
    },
    [references],
  );

  const calibrate = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) {
      setError('Start screen sharing first.');
      return false;
    }
    setStatus('reading');
    setError(null);
    try {
      const frame = grabFrame(session);
      const { profile, hits } = calibrateLayout(frame, references);
      if (hits.size === 0) {
        setError('Nothing recognisable on screen. Calibrate during champion select.');
        return false;
      }
      saveProfile(profile);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calibration failed.');
      return false;
    } finally {
      setStatus(sessionRef.current ? 'armed' : 'idle');
    }
  }, [references]);

  return { status, error, lastRead, arm, disarm, capture, calibrate };
}
