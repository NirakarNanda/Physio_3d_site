"use client";

import { useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { anatomyStore } from "@/lib/anatomyStore";
import { anatomySections } from "./anatomyData";
import { getActiveSectionIndex, getCameraKeyframe } from "./AnatomyTimeline";
import type { AnatomyGroupKey, AnatomyGroups } from "./anatomyMapping";
import { ANATOMY_GROUP_KEYS } from "./anatomyMapping";

const ACTIVE_EMPHASIS = 1;
const SUBDUED_EMPHASIS = 0.45;
const FULL_BODY_EMPHASIS = 1;

const tmpTarget = new THREE.Vector3();
const tmpPos = new THREE.Vector3();

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

  useFrame((_, delta) => {
    const progress = anatomyStore.getProgress();
    const sectionIndex = getActiveSectionIndex(progress);

    if (sectionIndex !== lastSectionIndex.current) {
      lastSectionIndex.current = sectionIndex;
      anatomyStore.setSectionIndex(sectionIndex);
    }

    // Narrower/taller viewports (tablet portrait, phone) need the camera
    // pulled back so the active region doesn't crop at the frame edges —
    // desktop keyframes stay untouched (Section 17).
    const aspect = size.width / size.height;
    const distanceScale = aspect < 0.6 ? 1.55 : aspect < 0.85 ? 1.25 : 1;

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
      const damp = 1 - Math.pow(0.001, delta);
      camera.position.lerp(tmpPos, damp);

      // Smoothly interpolate the look-at target too, otherwise the camera
      // orientation would snap even while position eases.
      const currentTarget = camera.userData.lookAtTarget ?? tmpTarget.clone();
      currentTarget.lerp(tmpTarget, damp);
      camera.userData.lookAtTarget = currentTarget;
      camera.lookAt(currentTarget);
    }

    const groups = groupsRef.current;
    if (!groups) return;

    const section = anatomySections[sectionIndex];
    const isFullBodyMoment = section.highlightGroups.length === 0;

    ANATOMY_GROUP_KEYS.forEach((key) => {
      const isActive = section.highlightGroups.includes(key);
      const desired = isFullBodyMoment
        ? FULL_BODY_EMPHASIS
        : isActive
        ? ACTIVE_EMPHASIS
        : SUBDUED_EMPHASIS;

      groups[key].forEach((node) => {
        const current = emphasisState.current.get(node) ?? 1;
        const next = reducedMotion ? desired : THREE.MathUtils.lerp(current, desired, 1 - Math.pow(0.0005, delta));
        emphasisState.current.set(node, next);
        applyEmphasis(node, next, isActive && section.separate && !reducedMotion, key);
      });
    });
  });

  return null;
}

/**
 * Maps a 0..1 emphasis value onto material brightness/opacity and a subtle
 * scale pulse, plus (when the active section calls for it) a small
 * positional offset that separates a joint's bones to reveal its structure
 * without ever looking dislocated (Section 9 / Section 7).
 */
function applyEmphasis(
  node: THREE.Object3D,
  emphasis: number,
  separate: boolean,
  _group: AnatomyGroupKey
) {
  if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
    const brightness = THREE.MathUtils.lerp(0.75, 1.15, emphasis);
    node.material.color.set("#EFE9DC").multiplyScalar(brightness);
    node.material.opacity = THREE.MathUtils.lerp(0.55, 1, emphasis);
    node.material.transparent = node.material.opacity < 1;
  }

  const scale = THREE.MathUtils.lerp(0.985, 1, emphasis);
  node.scale.setScalar(scale);

  if (separate) {
    const baseline = (node.userData.basePosition ??= node.position.clone());
    // separationOffset arrives from the GLB node extras as a plain
    // [x, y, z] array (see scripts/generate_skeleton_glb.py). Cache the
    // Vector3 on userData so we don't allocate one per node per frame.
    let offset = node.userData.separationVector as THREE.Vector3 | undefined;
    if (!offset) {
      const raw = node.userData.separationOffset as [number, number, number] | undefined;
      offset = raw ? new THREE.Vector3(raw[0], raw[1], raw[2]) : new THREE.Vector3(0, 0, 0);
      node.userData.separationVector = offset;
    }
    node.position.copy(baseline).addScaledVector(offset, 0.03 * emphasis);
  } else if (node.userData.basePosition) {
    node.position.lerp(node.userData.basePosition, 0.08);
  }
}
