import { laneGlyphPath } from '@/lib/lane-glyphs';

export function LaneGlyph({ lane, size = 15 }: { lane: string; size?: number }) {
  const d = laneGlyphPath(lane);
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden
      style={{ flex: 'none', opacity: 0.92 }}
    >
      <path d={d} />
    </svg>
  );
}
