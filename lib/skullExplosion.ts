/**
 * Mutable, non-React shared state for the skull "exploded view".
 *
 * Written every frame by AnatomyController (inside the R3F render loop),
 * read by SkullExplodedLabels in its own rAF loop, which positions the HTML
 * leader lines + labels imperatively. Kept outside React state on purpose —
 * this updates ~60x/sec and must not re-render anything (same rationale as
 * anatomyStore.progress).
 */
export interface ExplodedLabelAnchor {
  /** Screen-space position in CSS pixels, origin top-left. */
  x: number;
  y: number;
  /** False when the anchor is behind the camera. */
  visible: boolean;
}

interface SkullExplosionState {
  /** 0 = fully assembled, 1 = fully exploded. */
  factor: number;
  /** Anchors aligned 1:1 with SKULL_LABELS order in skullExplode.ts. */
  anchors: ExplodedLabelAnchor[];
  /** Viewport size in CSS pixels — the overlay's coordinate space. */
  width: number;
  height: number;
}

export const skullExplosionState: SkullExplosionState = {
  factor: 0,
  anchors: [],
  width: 0,
  height: 0,
};
