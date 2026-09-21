"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useReducedMotion } from "./useReducedMotion";
import { AnatomyLoader } from "./AnatomyLoader";
import { AnatomyErrorBoundary, AnatomyUnavailableMessage } from "./AnatomyErrorBoundary";
import { SkeletonModel } from "./SkeletonModel";
import { PlaceholderSkeleton } from "./PlaceholderSkeleton";
import { AnatomyController } from "./AnatomyController";
import type { AnatomyGroups } from "./anatomyMapping";

const USE_PLACEHOLDER = process.env.NEXT_PUBLIC_USE_PLACEHOLDER_SKELETON === "true";

// MODEL_SCALE / MODEL_Y_OFFSET: if your skeleton.glb isn't ~1.75m tall
// standing at the origin with feet at y=0, wrap <SkeletonModel/> below in
// <group scale={MODEL_SCALE} position={[0, MODEL_Y_OFFSET, 0]}> so the
// camera keyframes in anatomyData.ts stay valid without being rewritten.
const MODEL_SCALE = 1;
const MODEL_Y_OFFSET = 0;

function supportsWebGL(): boolean {
  if (typeof window === "undefined") return true; // assume yes on server, verify on mount
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export function AnatomyScene() {
  const reducedMotion = useReducedMotion();
  const groupsRef = useRef<AnatomyGroups | null>(null);
  // null = "haven't checked yet" (first client paint), avoids a hydration
  // mismatch between server render and the client's real WebGL check.
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(supportsWebGL());
  }, []);

  if (webglOk === false) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg">
        <div className="w-[260px] text-center font-body">
          <p className="text-[11px] uppercase tracking-label text-ink-muted">
            3D anatomy model unavailable
          </p>
          <p className="mt-2 text-xs text-ink-muted/80">
            This device or browser doesn&apos;t support WebGL, which the
            interactive skeleton needs. Try an up-to-date browser such as
            Chrome or Safari.
          </p>
        </div>
      </div>
    );
  }

  return (
    // The canvas is decorative for assistive technology: every region name
    // and description it illustrates is duplicated in AnatomyLabels and the
    // sr-only summary below, so it is hidden from the accessibility tree.
    <div aria-hidden="true" className="h-full w-full">
    <Canvas
      dpr={[1, Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1.5)]}
      camera={{ fov: 32, near: 0.1, far: 50, position: [0, 1.05, 4.4] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      shadows
      onCreated={({ gl, scene }) => {
        // Studio-style image-based lighting, generated locally at runtime
        // (no network HDR fetch). Gives the ivory bone its soft, realistic
        // sheen; kept subtle so the key light still models the forms.
        const pmrem = new THREE.PMREMGenerator(gl);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.5;
        pmrem.dispose();
      }}
    >
      <color attach="background" args={["#F7F5F0"]} />
      <hemisphereLight args={["#FFFDF8", "#D9D2C4", 0.35]} />
      <directionalLight
        position={[2.2, 3.2, 2.4]}
        intensity={1.35}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-2.2, 2.0, -2.2]} intensity={0.55} color="#E2E8F2" />
      <directionalLight position={[0, 0.6, 2.5]} intensity={0.22} color="#FFF6E8" />

      <Suspense fallback={<AnatomyLoader />}>
        <group scale={MODEL_SCALE} position={[0, MODEL_Y_OFFSET, 0]}>
          {USE_PLACEHOLDER ? (
            <PlaceholderSkeleton onReady={(groups) => (groupsRef.current = groups)} />
          ) : (
            <AnatomyErrorBoundary fallback={<AnatomyUnavailableMessage />}>
              <SkeletonModel onReady={(groups) => (groupsRef.current = groups)} />
            </AnatomyErrorBoundary>
          )}
        </group>
      </Suspense>

      <AnatomyController groupsRef={groupsRef} reducedMotion={reducedMotion} />
    </Canvas>
    </div>
  );
}
