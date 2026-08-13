import type { Bitmap } from '@wild-rift-forge/vision';

/**
 * Screen-share plumbing for draft capture.
 *
 * Everything here is browser-only and deliberately thin: it acquires a
 * `getDisplayMedia` stream, pulls single frames from it on demand, and hands a plain
 * {@link Bitmap} to the pure recognition code. No frame ever leaves the device.
 */

export type CaptureErrorReason =
  | 'unsupported'
  | 'denied'
  | 'no-video-track'
  | 'not-armed'
  | 'frame-failed';

export class CaptureError extends Error {
  readonly reason: CaptureErrorReason;

  constructor(reason: CaptureErrorReason, message: string) {
    super(message);
    this.name = 'CaptureError';
    this.reason = reason;
  }
}

export function isCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
    typeof document !== 'undefined'
  );
}

/**
 * A live screen share plus the offscreen video and canvas used to sample it.
 * Held open between captures so re-triggering costs a single frame draw rather than
 * another permission prompt.
 */
export type CaptureSession = {
  stream: MediaStream;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
};

const CAPTURE_CONSTRAINTS: DisplayMediaStreamOptions = {
  video: {
    frameRate: { ideal: 5, max: 15 },
  },
  audio: false,
};

/**
 * Prompt for a screen share and wait until the video is actually producing frames.
 * Resolving early would let the first capture read a blank canvas.
 */
export async function armCapture(): Promise<CaptureSession> {
  if (!isCaptureSupported()) {
    throw new CaptureError('unsupported', 'Screen capture needs a desktop browser.');
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia(CAPTURE_CONSTRAINTS);
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'NotAllowedError' || name === 'AbortError') {
      throw new CaptureError('denied', 'Screen share was cancelled.');
    }
    throw new CaptureError('denied', 'Could not start screen sharing.');
  }

  if (stream.getVideoTracks().length === 0) {
    stream.getTracks().forEach((track) => track.stop());
    throw new CaptureError('no-video-track', 'The selected source has no video.');
  }

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  try {
    await video.play();
    await waitForFrame(video);
  } catch {
    stopCapture({ stream, video, canvas: document.createElement('canvas') });
    throw new CaptureError('frame-failed', 'The shared screen never produced a frame.');
  }

  return { stream, video, canvas: document.createElement('canvas') };
}

function waitForFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('timed out waiting for a frame'));
    }, 5000);
    const onReady = () => {
      if (video.videoWidth === 0) return;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('resize', onReady);
    };
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('resize', onReady);
  });
}

/** True once the user has stopped sharing from the browser's own share bar. */
export function isSessionLive(session: CaptureSession | null): boolean {
  return Boolean(session?.stream.getVideoTracks().some((track) => track.readyState === 'live'));
}

/**
 * Run a callback when the user ends the share from the browser chrome, which
 * bypasses our own UI entirely.
 */
export function onCaptureEnded(session: CaptureSession, handler: () => void): () => void {
  const tracks = session.stream.getVideoTracks();
  tracks.forEach((track) => track.addEventListener('ended', handler));
  return () => tracks.forEach((track) => track.removeEventListener('ended', handler));
}

export function stopCapture(session: CaptureSession | null): void {
  if (!session) return;
  session.stream.getTracks().forEach((track) => track.stop());
  session.video.srcObject = null;
  session.video.remove();
}

/**
 * Draw the current frame and return it as a plain RGBA bitmap.
 *
 * `willReadFrequently` matters here: without it browsers keep the canvas on the GPU
 * and every `getImageData` costs a readback, which is most of the capture budget.
 */
export function grabFrame(session: CaptureSession): Bitmap {
  const { video, canvas } = session;
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    throw new CaptureError('frame-failed', 'The shared screen is not producing frames.');
  }

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new CaptureError('frame-failed', 'Could not read pixels from the shared screen.');
  }

  context.drawImage(video, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  return { width: image.width, height: image.height, data: image.data };
}
