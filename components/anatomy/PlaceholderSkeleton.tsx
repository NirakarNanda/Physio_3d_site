"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { AnatomyGroupKey, AnatomyGroups } from "./anatomyMapping";
import { ANATOMY_GROUP_KEYS } from "./anatomyMapping";

interface BonePrimitive {
  group: AnatomyGroupKey;
  position: [number, number, number];
  args:
    | { type: "capsule"; radius: number; length: number; rotation?: [number, number, number] }
    | { type: "sphere"; radius: number }
    | { type: "box"; size: [number, number, number] };
}

// Coarse standing rig — purely structural, NOT a substitute for the real
// anatomical GLB. Only ever rendered when NEXT_PUBLIC_USE_PLACEHOLDER_SKELETON
// is "true" (dev preview); the production build uses /models/skeleton.glb.
const PRIMITIVES: BonePrimitive[] = [
  { group: "skull", position: [0, 1.63, 0], args: { type: "sphere", radius: 0.13 } },
  { group: "spine", position: [0, 1.15, 0], args: { type: "capsule", radius: 0.05, length: 0.55, rotation: [0, 0, 0] } },
  { group: "ribCage", position: [0, 1.28, 0], args: { type: "capsule", radius: 0.16, length: 0.3 } },
  { group: "shoulder", position: [0.22, 1.44, 0], args: { type: "sphere", radius: 0.06 } },
  { group: "shoulder", position: [-0.22, 1.44, 0], args: { type: "sphere", radius: 0.06 } },
  { group: "arm", position: [0.32, 1.08, 0], args: { type: "capsule", radius: 0.035, length: 0.55 } },
  { group: "arm", position: [-0.32, 1.08, 0], args: { type: "capsule", radius: 0.035, length: 0.55 } },
  { group: "hand", position: [0.36, 0.72, 0], args: { type: "box", size: [0.07, 0.16, 0.03] } },
  { group: "hand", position: [-0.36, 0.72, 0], args: { type: "box", size: [0.07, 0.16, 0.03] } },
  { group: "pelvis", position: [0, 0.9, 0], args: { type: "box", size: [0.34, 0.16, 0.16] } },
  { group: "hip", position: [0.14, 0.85, 0], args: { type: "sphere", radius: 0.06 } },
  { group: "hip", position: [-0.14, 0.85, 0], args: { type: "sphere", radius: 0.06 } },
  { group: "knee", position: [0.14, 0.46, 0], args: { type: "capsule", radius: 0.045, length: 0.75 } },
  { group: "knee", position: [-0.14, 0.46, 0], args: { type: "capsule", radius: 0.045, length: 0.75 } },
  { group: "ankle", position: [0.13, 0.1, 0], args: { type: "sphere", radius: 0.045 } },
  { group: "ankle", position: [-0.13, 0.1, 0], args: { type: "sphere", radius: 0.045 } },
  { group: "foot", position: [0.14, 0.03, 0.08], args: { type: "box", size: [0.08, 0.05, 0.22] } },
  { group: "foot", position: [-0.14, 0.03, 0.08], args: { type: "box", size: [0.08, 0.05, 0.22] } },
];

/**
 * Builds the same AnatomyGroups shape that anatomyMapping.buildAnatomyGroups()
 * produces from a real GLB, so AnatomyController doesn't need to know
 * whether it's driving a real model or this placeholder.
 */
export function PlaceholderSkeleton({
  onReady,
}: {
  onReady: (groups: AnatomyGroups) => void;
}) {
  const meshRefs = useMemo(() => {
    const groups = ANATOMY_GROUP_KEYS.reduce((acc, key) => {
      acc[key] = [];
      return acc;
    }, {} as AnatomyGroups);
    return groups;
  }, []);

  return (
    <group
      ref={(node) => {
        if (!node) return;
        // Clear first: without this, remounts would accumulate duplicate
        // mesh references in the group arrays on every re-render.
        ANATOMY_GROUP_KEYS.forEach((key) => {
          meshRefs[key] = [];
        });
        node.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.anatomyGroup) {
            const key = child.userData.anatomyGroup as AnatomyGroupKey;
            if (!meshRefs[key].includes(child)) meshRefs[key].push(child);
          }
        });
        onReady(meshRefs);
      }}
    >
      {PRIMITIVES.map((bone, i) => (
        <mesh
          key={i}
          position={bone.position}
          rotation={bone.args.type === "capsule" ? bone.args.rotation ?? [0, 0, 0] : [0, 0, 0]}
          userData={{ anatomyGroup: bone.group }}
          castShadow
          receiveShadow
        >
          {bone.args.type === "sphere" && <sphereGeometry args={[bone.args.radius, 24, 24]} />}
          {bone.args.type === "box" && <boxGeometry args={bone.args.size} />}
          {bone.args.type === "capsule" && (
            <capsuleGeometry args={[bone.args.radius, bone.args.length, 8, 16]} />
          )}
          <meshStandardMaterial
            color="#EFE9DC"
            roughness={0.55}
            metalness={0.02}
          />
        </mesh>
      ))}
    </group>
  );
}
