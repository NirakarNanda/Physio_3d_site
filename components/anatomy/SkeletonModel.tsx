"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { buildAnatomyGroups, flattenGroups, type AnatomyGroupKey, type AnatomyGroups } from "./anatomyMapping";

const MODEL_PATH = "/models/skeleton.glb";

/**
 * Exact-name overrides applied before keyword matching. The CT export
 * names its two plantar sesamoids (under the big toe) generically, so
 * keyword matching would file them under the hand group — they belong
 * to the foot. Callers can extend via the `overrides` prop.
 */
const MODEL_OVERRIDES: Partial<Record<AnatomyGroupKey, string[]>> = {
  foot: ["sesamoids", "sesamoids_001"],
};

// The CT skeleton GLB is Draco-compressed. The decoder WASM/JS is served
// from /public/draco (copied from three's examples/jsm/libs/draco).
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

function withDraco(loader: GLTFLoader) {
  loader.setDRACOLoader(dracoLoader);
}

// Preload the GLB as soon as this module is imported — but only when the
// real model path is active. In placeholder mode the canvas renders the
// procedural PlaceholderSkeleton instead, so preloading would fetch a
// megabyte we never display.
if (process.env.NEXT_PUBLIC_USE_PLACEHOLDER_SKELETON !== "true") {
  useLoader.preload(GLTFLoader, MODEL_PATH, withDraco);
}

const IVORY = new THREE.Color("#EFE9DC");
const SOCKET = new THREE.Color("#453D34");
const CARTILAGE = new THREE.Color("#E9EDEA");
const ENAMEL = new THREE.Color("#FBFAF6");

// Shared materials — one instance per finish, created once per module load.
// (Previously these were per-mesh; sharing cuts GPU program churn and the
// unmount cleanup no longer disposes materials still in use by a remount.)
const ivoryMaterial = new THREE.MeshStandardMaterial({
  color: IVORY,
  roughness: 0.52,
  metalness: 0.02,
  envMapIntensity: 0.55,
});
const socketMaterial = new THREE.MeshStandardMaterial({
  color: SOCKET,
  roughness: 0.95,
  metalness: 0,
  envMapIntensity: 0.25,
});
const cartilageMaterial = new THREE.MeshStandardMaterial({
  color: CARTILAGE,
  roughness: 0.35,
  metalness: 0,
  envMapIntensity: 0.7,
});
const enamelMaterial = new THREE.MeshStandardMaterial({
  color: ENAMEL,
  roughness: 0.28,
  metalness: 0,
  envMapIntensity: 0.8,
});

/**
 * Applies the "professional anatomical medical model" material treatment
 * (Section 9): warm ivory bone, dark recessed eye/nasal sockets, pale
 * costal cartilage, bright enamel teeth. Runs once per mesh on load.
 */
function applyMedicalMaterial(mesh: THREE.Mesh) {
  const name = mesh.name;
  const material = /socket|cavity/i.test(name)
    ? socketMaterial
    : /cartilage/i.test(name)
      ? cartilageMaterial
      : /teeth|tooth/i.test(name)
        ? enamelMaterial
        : ivoryMaterial;
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
  const { scene } = useLoader(GLTFLoader, MODEL_PATH, withDraco);

  // Clone so hot-reloads / repeated mounts don't mutate the cached GLTF.
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    cloned.traverse((node) => {
      if (node instanceof THREE.Mesh) applyMedicalMaterial(node);
    });

    const { groups, unassigned } = buildAnatomyGroups(cloned, {
      ...MODEL_OVERRIDES,
      ...overrides,
    });

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

    // No per-mesh disposal here: materials are shared module-level instances
    // (see above) and geometries belong to the cached GLTF. Disposing them
    // on unmount would break Fast Refresh remounts.
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned]);

  return <primitive object={cloned} />;
}
