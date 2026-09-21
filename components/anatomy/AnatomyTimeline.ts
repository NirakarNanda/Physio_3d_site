import { anatomySections, type AnatomySection, type Vec3 } from "./anatomyData";

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Smootherstep — gentler ease at both ends than linear, avoids mechanical camera motion. */
function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function getActiveSectionIndex(progress: number, sections: AnatomySection[] = anatomySections): number {
  const p = clamp01(progress);
  for (let i = 0; i < sections.length; i++) {
    if (p >= sections[i].start && p < sections[i].end) return i;
  }
  return sections.length - 1;
}

export function getLocalProgress(progress: number, section: AnatomySection): number {
  const span = section.end - section.start;
  if (span <= 0) return 1;
  return clamp01((clamp01(progress) - section.start) / span);
}

export interface CameraKeyframe {
  position: Vec3;
  target: Vec3;
}

/**
 * Computes the interpolated camera keyframe for a given global scroll
 * progress. Rather than snapping between each section's camera pose, we
 * blend the PREVIOUS and CURRENT section's keyframes across the current
 * section's local progress, so the camera drifts continuously through the
 * entire timeline instead of stepping at section boundaries.
 *
 * The zoom completes ~55% of the way through each section (rather than at
 * its very end), so the zoomed-in state — with its key-structure labels —
 * is what the reader actually spends time looking at, instead of a camera
 * that only arrives as the section is already leaving.
 *
 * `distanceScale` pushes the resolved position further from (>1) or closer
 * to (<1) its target along the same viewing axis, without touching the
 * authored keyframes in anatomyData.ts. This is what lets narrower/taller
 * viewports (tablet, mobile) back the camera out just enough to keep the
 * active region fully in frame instead of cropping it (Section 17).
 */
export function getCameraKeyframe(
  progress: number,
  sections: AnatomySection[] = anatomySections,
  distanceScale: number = 1
): CameraKeyframe {
  const index = getActiveSectionIndex(progress, sections);
  const current = sections[index];
  const previous = sections[Math.max(0, index - 1)];
  const rawLocal = getLocalProgress(progress, current);
  const zoomT = smootherstep(clamp01(rawLocal / 0.55));

  const position = lerpVec3(previous.cameraPosition, current.cameraPosition, zoomT);
  const target = lerpVec3(previous.cameraTarget, current.cameraTarget, zoomT);

  if (distanceScale === 1) return { position, target };

  const scaledPosition: Vec3 = [
    target[0] + (position[0] - target[0]) * distanceScale,
    target[1] + (position[1] - target[1]) * distanceScale,
    target[2] + (position[2] - target[2]) * distanceScale,
  ];

  return { position: scaledPosition, target };
}
