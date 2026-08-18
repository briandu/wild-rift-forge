'use client';

import type { LayoutProfile, LayoutRegion, NormalizedRect, Rect } from '@wild-rift-forge/vision';
import type { CalibStatus, CaptureStatus } from '@/lib/capture/use-draft-capture';
import type { AppliedRead } from '@/lib/capture/to-draft-state';
import { PHASE_HEADER, phaseLabel } from '@wild-rift-forge/vision';
import styles from './DraftScreenRead.module.css';

function boxClass(role: LayoutRegion['role']): string {
  if (role === 'ally') return styles.boxAlly ?? '';
  if (role === 'enemy') return styles.boxEnemy ?? '';
  if (role === 'ban-ally') return styles.boxBanAlly ?? '';
  return styles.boxBanEnemy ?? '';
}

/** Map a content-relative region onto the full preview, including letterbox bars. */
function previewStyle(
  rect: NormalizedRect,
  contentBounds: Rect,
  sourceWidth: number,
  sourceHeight: number,
) {
  return {
    left: `${((contentBounds.x + rect.x * contentBounds.width) / sourceWidth) * 100}%`,
    top: `${((contentBounds.y + rect.y * contentBounds.height) / sourceHeight) * 100}%`,
    width: `${((rect.width * contentBounds.width) / sourceWidth) * 100}%`,
    height: `${((rect.height * contentBounds.height) / sourceHeight) * 100}%`,
  };
}

export function DraftScreenRead({
  status,
  calib,
  previewUrl,
  profile,
  lastRead,
  error,
  compact = false,
  onArm,
  onCalibrate,
  onDisarm,
}: {
  status: CaptureStatus;
  calib: CalibStatus;
  previewUrl: string | null;
  profile: LayoutProfile | null;
  lastRead: AppliedRead | null;
  error: string | null;
  compact?: boolean;
  onArm: () => void;
  onCalibrate: () => void;
  onDisarm: () => void;
}) {
  const armed = status === 'armed' || status === 'reading';
  const live = calib === 'done' && armed;
  const allyHits = lastRead?.state.allies.filter((slot) => slot.slug).length ?? 0;
  const enemyHits = lastRead?.state.enemies.filter((slot) => slot.slug).length ?? 0;
  const banHits =
    (lastRead?.state.allyBans.filter(Boolean).length ?? 0) +
    (lastRead?.state.enemyBans.filter(Boolean).length ?? 0);
  const regions = [
    { k: 'Ally column', v: lastRead ? `${allyHits} of 5 read` : '—', ok: allyHits > 0 },
    { k: 'Enemy column', v: lastRead ? `${enemyHits} of 5 read` : '—', ok: enemyHits > 0 },
    {
      k: 'Phase timer',
      v: lastRead && lastRead.phase !== 'unknown' ? phaseLabel(lastRead.phase) : 'Reading',
      ok: Boolean(lastRead && lastRead.phase !== 'unknown'),
    },
    { k: 'Ban row', v: banHits ? `${banHits} read` : 'Partly hidden', ok: banHits >= 6 },
  ];

  const liveProfile = lastRead?.profile ?? profile;
  const slotBoxes = liveProfile?.regions ?? [];
  const laneBoxes = liveProfile?.laneLabelRegions ?? [];
  const sourceWidth = lastRead?.sourceWidth ?? 0;
  const sourceHeight = lastRead?.sourceHeight ?? 0;
  const contentBounds = lastRead?.contentBounds ?? {
    x: 0,
    y: 0,
    width: sourceWidth || 1,
    height: sourceHeight || 1,
  };

  return (
    <div className={`${styles.card} ${compact ? styles.compact : ''}`}>
      <div className={styles.head}>
        <div className={styles.kicker}>SCREEN READ</div>
        {live ? (
          <div className={styles.live}>
            <span className={styles.liveDot} />
            {compact ? 'RECORDING' : 'LIVE'}
            {!compact && lastRead && lastRead.phase !== 'unknown'
              ? ` · ${phaseLabel(lastRead.phase)}`
              : ''}
          </div>
        ) : null}
      </div>

      <div className={styles.body}>
        <div
          className={styles.preview}
          style={
            sourceWidth > 0 && sourceHeight > 0
              ? { aspectRatio: `${sourceWidth} / ${sourceHeight}` }
              : undefined
          }
        >
          {previewUrl ? (
            // Captured frame stays on-device as a data URL until the owner saves the session.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="What the screen share is reading" className={styles.frame} />
          ) : (
            <div className={styles.placeholder} aria-hidden />
          )}
          {live && sourceWidth > 0
            ? slotBoxes.map((region) => (
                <div
                  key={region.key}
                  className={`${styles.box} ${boxClass(region.role)}`}
                  style={previewStyle(region.rect, contentBounds, sourceWidth, sourceHeight)}
                />
              ))
            : null}
          {live && sourceWidth > 0
            ? laneBoxes.map((region) => (
                <div
                  key={`lane-${region.key}`}
                  className={`${styles.box} ${styles.boxLane}`}
                  style={previewStyle(region.rect, contentBounds, sourceWidth, sourceHeight)}
                />
              ))
            : null}
          {live && sourceWidth > 0 ? (
            <div
              className={`${styles.box} ${styles.boxPhase}`}
              style={previewStyle(PHASE_HEADER, contentBounds, sourceWidth, sourceHeight)}
            />
          ) : null}
          {calib === 'running' ? (
            <div className={styles.overlay}>
              <span className={styles.spinner} />
              {compact ? null : <span className={styles.overlayK}>CALIBRATING</span>}
            </div>
          ) : null}
          {calib === 'idle' && !armed ? (
            <div className={styles.overlay}>
              {compact ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5C5878" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <path d="M8 19h8" />
                </svg>
              ) : (
                <>
                  <span className={styles.overlayCopy}>
                    Mirror your phone, then calibrate to map the lobby.
                  </span>
                  <button type="button" className={styles.cta} onClick={onArm} disabled={status === 'arming'}>
                    {status === 'arming' ? 'Waiting for share…' : 'Share screen'}
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className={styles.meta}>
          {status === 'unsupported' ? (
            <p className={styles.copy}>Screen capture needs a desktop browser. The board still works by hand.</p>
          ) : calib === 'idle' && compact ? (
            <>
              <p className={styles.copy}>Start a screen recording, then calibrate so we know where the lobby sits.</p>
              <button type="button" className={styles.cta} onClick={onArm} disabled={status === 'arming'}>
                {status === 'arming' ? 'Waiting…' : 'Calibrate'}
              </button>
            </>
          ) : calib === 'running' && compact ? (
            <div className={styles.finding}>
              <span className={styles.spinnerSm} />
              Finding the pick columns…
            </div>
          ) : live ? (
            <>
              {regions.map((row) => (
                <div key={row.k} className={styles.region}>
                  <span className={styles.regionDot} style={{ background: row.ok ? '#8FEDB8' : '#F0A87B' }} />
                  <span className={styles.regionK}>{row.k}</span>
                  <span className={styles.regionV} style={{ color: row.ok ? '#8FEDB8' : '#F0A87B' }}>
                    {row.v}
                  </span>
                </div>
              ))}
              <button type="button" className={styles.textBtn} onClick={onCalibrate}>
                Recalibrate
              </button>
              {armed ? (
                <button type="button" className={styles.textBtn} onClick={onDisarm}>
                  Stop
                </button>
              ) : null}
            </>
          ) : armed ? (
            <>
              <p className={styles.copy}>Share is live. Calibrate on a champion-select screen to map the lobby.</p>
              <button type="button" className={styles.cta} onClick={onCalibrate}>
                Calibrate
              </button>
            </>
          ) : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
