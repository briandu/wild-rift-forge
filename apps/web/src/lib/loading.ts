export const SKELETON_SHOW_MS = 300;
export const SKELETON_HOLD_MS = 400;
export const SKELETON_SWEEP_S = 1.4;
export const SKELETON_STAGGER_S = 0.06;
export const SKELETON_STAGGER_CAP_S = 0.3;
export const SEARCH_DEBOUNCE_MS = 250;

export function skeletonDelay(index: number): string {
  return `${Math.min(Math.max(index, 0) * SKELETON_STAGGER_S, SKELETON_STAGGER_CAP_S)}s`;
}

export function holdRemainingMs(shownForMs: number): number {
  return Math.max(0, SKELETON_HOLD_MS - Math.max(0, shownForMs));
}
