/**
 * Mutable, non-React shared state for the scroll-driven "exploded views".
 *
 * Written every frame by AnatomyController (inside the R3F render loop),
 * read by ExplodedLabels in its own rAF loop, which positions the HTML
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

interface ExplosionState {
  /** 0 = fully assembled, 1 = fully exploded. */
  factor: number;
  /**
   * Which section's label set the anchors align with (1:1 with that
   * section's ExplodeSectionConfig.labels order). Null when no section is
   * exploding.
   */
  sectionId: string | null;
  anchors: ExplodedLabelAnchor[];
  /** Viewport size in CSS pixels — the overlay's coordinate space. */
  width: number;
  height: number;
}

export const explosionState: ExplosionState = {
  factor: 0,
  sectionId: null,
  anchors: [],
  width: 0,
  height: 0,
};
