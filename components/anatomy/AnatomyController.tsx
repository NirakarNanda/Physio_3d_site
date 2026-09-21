"use client";

import { useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { anatomyStore } from "@/lib/anatomyStore";
import { anatomySections } from "./anatomyData";
import { getActiveSectionIndex, getCameraKeyframe } from "./AnatomyTimeline";
import {
  getExplodeConfig,
  getExplosionFactor,
  publishExplosionAnchors,
  resetExplosionState,
  writeExplodeVector,
  type ExplodeSectionConfig,
} from "./explodeView";
import type { AnatomyGroups } from "./anatomyMapping";
import { ANATOMY_GROUP_KEYS } from "./anatomyMapping";

const ACTIVE_EMPHASIS = 1;
const SUBDUED_EMPHASIS = 0.45;
const FULL_BODY_EMPHASIS = 1;

const tmpTarget = new THREE.Vector3();
const tmpPos = new THREE.Vector3();
const tmpOffset = new THREE.Vector3();
const tmpExplode = new THREE.Vector3();

export function AnatomyController({
  groupsRef,
  reducedMotion,
}: {
  groupsRef: MutableRefObject<AnatomyGroups | null>;
  reducedMotion: boolean;
}) {
  const { camera, size } = useThree();
  const lastSectionIndex = useRef(-1);
  const emphasisState = useRef<Map<THREE.Object3D, number>>(new Map());
  const explodeFactor = useRef(0);

  useFrame((_, delta) => {
    const progress = anatomyStore.getProgress();
    const sectionIndex = getActiveSectionIndex(progress);

    if (sectionIndex !== lastSectionIndex.current) {
      lastSectionIndex.current = sectionIndex;
      anatomyStore.setSectionIndex(sectionIndex);
    }

    // Exploded views: scroll-scrubbed factor per section, smoothed with the
    // same damping as the camera so the parts and the dolly stay in sync.
    // Each section's config picks which group separates, how far, and how
    // far the camera pulls back to keep the spread framed.
    const section = anatomySections[sectionIndex];
    const explodeCfg: ExplodeSectionConfig | undefined =
      reducedMotion || !section ? undefined : getExplodeConfig(section.id);
    const groups = groupsRef.current;
    const damp = 1 - Math.pow(0.001, delta);
    if (groups) {
      const target = explodeCfg ? getExplosionFactor(progress, section) : 0;
      explodeFactor.current = reducedMotion
        ? target
        : THREE.MathUtils.lerp(explodeFactor.current, target, damp);
      if (explodeFactor.current < 0.0005) explodeFactor.current = 0;
    }
    const explode = explodeFactor.current;
    // Non-null while the active section's parts are mid-explosion; drives
    // both the node offsets and the leader-line anchors below.
    const exploding =
      explodeCfg && explode > 0 ? { cfg: explodeCfg, factor: explode } : null;

    // Narrower/taller viewports (tablet portrait, phone) need the camera
    // pulled back so the active region doesn't crop at the frame edges —
    // desktop keyframes stay untouched (Section 17). The explosion gets an
    // extra per-section pull-back so the separated parts stay framed at
    // full spread (verified headlessly: max |NDC| 0.93, 16:9).
    const aspect = size.width / size.height;
    const distanceScale =
      (aspect < 0.6 ? 1.55 : aspect < 0.85 ? 1.25 : 1) *
      (1 + (explodeCfg?.pullback ?? 0) * explode);

    const { position, target } = getCameraKeyframe(progress, anatomySections, distanceScale);
    tmpPos.set(...position);
    tmpTarget.set(...target);

    if (reducedMotion) {
      // Respect prefers-reduced-motion: no continuous camera drift. Snap
      // directly to the active section's resting pose instead of easing.
      camera.position.copy(tmpPos);
      camera.lookAt(tmpTarget);
    } else {
      // Critically-damped exponential smoothing — frame-rate independent,
      // and reads as a deliberate, controlled dolly rather than a snap.
      camera.position.lerp(tmpPos, damp);

      // Smoothly interpolate the look-at target too, otherwise the camera
      // orientation would snap even while position eases.
      const currentTarget = camera.userData.lookAtTarget ?? tmpTarget.clone();
      currentTarget.lerp(tmpTarget, damp);
      camera.userData.lookAtTarget = currentTarget;
      camera.lookAt(currentTarget);
    }

    if (!groups) return;

    const isFullBodyMoment = section.highlightGroups.length === 0;

    ANATOMY_GROUP_KEYS.forEach((key) => {
      const isActive = section.highlightGroups.includes(key);
      const desired = isFullBodyMoment
        ? FULL_BODY_EMPHASIS
        : isActive
        ? ACTIVE_EMPHASIS
        : SUBDUED_EMPHASIS;

      // Only the exploding section's group moves; the leader-line overlay
      // picks up the same config so anchors match the parts.
      const explodeHere =
        exploding && exploding.cfg.groupKey === key ? exploding : null;

      groups[key].forEach((node) => {
        const current = emphasisState.current.get(node) ?? 1;
        const next = reducedMotion ? desired : THREE.MathUtils.lerp(current, desired, 1 - Math.pow(0.0005, delta));
        emphasisState.current.set(node, next);
        applyEmphasis(
          node,
          next,
          isActive && section.separate && !reducedMotion,
          explodeHere
        );
      });
    });

    // Publish the projected anchors for the leader-line overlay after the
    // emphasis pass, so node positions are final for this frame.
    if (exploding) {
      publishExplosionAnchors(
        groups,
        exploding.cfg,
        camera,
        size.width,
        size.height,
        exploding.factor
      );
    } else {
      resetExplosionState();
    }
  });

  return null;
}

/**
 * Maps a 0..1 emphasis value onto material brightness/opacity and a subtle
 * scale pulse, plus (when the active section calls for it) a small
 * positional offset that separates a joint's bones to reveal its structure
 * without ever looking dislocated (Section 9 / Section 7). When the active
 * section is mid-explosion, the exploding group's nodes additionally travel
 * along their explosion vectors — scaled by the scroll-scrubbed factor.
 */
function applyEmphasis(
  node: THREE.Object3D,
  emphasis: number,
  separate: boolean,
  explode: { cfg: ExplodeSectionConfig; factor: number } | null
) {
  if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
    const brightness = THREE.MathUtils.lerp(0.75, 1.15, emphasis);
    node.material.color.set("#EFE9DC").multiplyScalar(brightness);
    node.material.opacity = THREE.MathUtils.lerp(0.55, 1, emphasis);
    node.material.transparent = node.material.opacity < 1;
  }

  const scale = THREE.MathUtils.lerp(0.985, 1, emphasis);
  node.scale.setScalar(scale);

  if (separate || explode) {
    const baseline = (node.userData.basePosition ??= node.position.clone()) as THREE.Vector3;
    tmpOffset.set(0, 0, 0);
    if (separate) {
      // separationOffset arrives from the GLB node extras as a plain
      // [x, y, z] array (see scripts/generate_skeleton_glb.py). Cache the
      // Vector3 on userData so we don't allocate one per node per frame.
      let offset = node.userData.separationVector as THREE.Vector3 | undefined;
      if (!offset) {
        const raw = node.userData.separationOffset as [number, number, number] | undefined;
        offset = raw ? new THREE.Vector3(raw[0], raw[1], raw[2]) : new THREE.Vector3(0, 0, 0);
        node.userData.separationVector = offset;
      }
      tmpOffset.addScaledVector(offset, 0.03 * emphasis);
    }
    if (explode) {
      writeExplodeVector(tmpExplode, node, explode.cfg);
      tmpOffset.addScaledVector(tmpExplode, explode.factor);
    }
    node.position.copy(baseline).add(tmpOffset);
  } else if (node.userData.basePosition) {
    node.position.lerp(node.userData.basePosition, 0.08);
  }
}
