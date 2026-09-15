export type PortraitAnchor = { id: string; x: number };
export type PackedPortrait = PortraitAnchor & { anchorX: number; rise: number };

/**
 * Pack portraits upward from a baseline while keeping each close to its rank.
 * The rise is visual spacing only; the portrait's x anchor remains its percentile.
 */
export function packPortraits(
  anchors: PortraitAnchor[],
  { minX, maxX, radius = 22, gap = 3, maxNudge = 28 }: {
    minX: number;
    maxX: number;
    radius?: number;
    gap?: number;
    maxNudge?: number;
  },
): PackedPortrait[] {
  const separation = radius * 2 + gap;
  const packed: PackedPortrait[] = [];
  const offsets = [0, -maxNudge / 2, maxNudge / 2, -maxNudge, maxNudge];

  for (const anchor of [...anchors].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))) {
    const anchorX = Math.max(minX, Math.min(maxX, anchor.x));
    let best = { x: anchorX, rise: Infinity, score: Infinity };
    for (const offset of offsets) {
      const x = Math.max(minX, Math.min(maxX, anchorX + offset));
      const blocked: [number, number][] = [];
      for (const previous of packed) {
        const dx = Math.abs(previous.x - x);
        if (dx < separation) {
          const dy = Math.sqrt(separation ** 2 - dx ** 2);
          blocked.push([previous.rise - dy, previous.rise + dy]);
        }
      }
      let rise = 0;
      for (const [low, high] of blocked.sort((a, b) => a[0] - b[0])) {
        if (rise > low + 1e-7 && rise < high) rise = high;
      }
      // Small shifts allow a clump to nest together; distant ranks stay distinct.
      const score = rise + Math.abs(x - anchorX) * 0.45;
      if (score < best.score) best = { x, rise, score };
    }
    packed.push({ id: anchor.id, x: best.x, anchorX, rise: best.rise });
  }
  return packed;
}
