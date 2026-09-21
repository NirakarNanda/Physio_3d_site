"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { buildAnatomyGroups, flattenGroups, type AnatomyGroups } from "./anatomyMapping";

const MODEL_PATH = "/models/skeleton.glb";

// Preload the GLB as soon as this module is imported — but only when the
// real model path is active. In placeholder mode the canvas renders the
// procedural PlaceholderSkeleton instead, so preloading would fetch a
// megabyte we never display.
if (process.env.NEXT_PUBLIC_USE_PLACEHOLDER_SKELETON !== "true") {
  useGLTF.preload(MODEL_PATH);
}

const IVORY = new THREE.Color("#EFE9DC");

/**
 * Applies the "professional anatomical medical model" material treatment
 * (Section 9): warm ivory, soft roughness, no metalness, no vertex colors
 * fighting the palette. Runs once per mesh on load.
 */
function applyMedicalMaterial(mesh: THREE.Mesh) {
  const material = new THREE.MeshStandardMaterial({
    color: IVORY,
    roughness: 0.55,
    metalness: 0.03,
    envMapIntensity: 0.6,
  });
  mesh.material = material;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

export function SkeletonModel({
  onReady,
  overrides,
}: {
  onReady: (groups: AnatomyGroups) => void;
  overrides?: Parameters<typeof buildAnatomyGroups>[1];
}) {
  const { scene } = useGLTF(MODEL_PATH);

  // Clone so hot-reloads / repeated mounts don't mutate the cached GLTF.
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    cloned.traverse((node) => {
      if (node instanceof THREE.Mesh) applyMedicalMaterial(node);
    });

    const { groups, unassigned } = buildAnatomyGroups(cloned, overrides);

    if (process.env.NODE_ENV === "development" && unassigned.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[AnatomyModel] ${unassigned.length} mesh(es) could not be auto-classified into an anatomy group:`,
        unassigned.map((n) => n.name)
      );
    }

    // Every mesh, classified or not, still needs a baseline "full body"
    // emphasis value for the intro/outro states.
    flattenGroups(groups).forEach((node) => {
      node.userData.emphasis = 1;
    });

    onReady(groups);

    return () => {
      // Dispose the per-mesh materials we created so repeated mounts
      // (Fast Refresh, route changes) don't leak GPU programs.
      cloned.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          const material = node.material as THREE.Material | THREE.Material[];
          if (Array.isArray(material)) {
            material.forEach((m) => m.dispose());
          } else {
            material.dispose();
          }
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned]);

  return <primitive object={cloned} />;
}
