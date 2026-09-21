import * as THREE from "three";
import { anatomySections } from "./anatomyData";
import { clamp01 } from "./AnatomyTimeline";
import { skullExplosionState } from "@/lib/skullExplosion";
import type { AnatomyGroups } from "./anatomyMapping";

/**
 * Exploded-view offsets per skull mesh, in meters. The skull is ~0.26 m
 * tall; these offsets spread it to ~0.62 m at full explosion. Mostly
 * vertical (the classic technical-illustration axis) with forward/lateral
 * accents so the facial bones fan out toward the viewer, and layered
 * depth (e.g. orbit rim flies further than its socket).
 */
const EXPLODE_OFFSETS: Record<string, [number, number, number]> = {
  Skull_Cranium: [0, 0.136, -0.03],
  Skull_BrowRidge: [0, 0.048, 0.13],
  Skull_OrbitRim_L: [-0.05, 0.024, 0.15],
  Skull_OrbitRim_R: [0.05, 0.024, 0.15],
  Skull_OrbitSocket_L: [-0.035, 0.016, 0.11],
  Skull_OrbitSocket_R: [0.035, 0.016, 0.11],
  Skull_NasalBone_L: [-0.02, 0.008, 0.15],
  Skull_NasalBone_R: [0.02, 0.008, 0.15],
  Skull_NasalCavity: [0, -0.008, 0.1],
  Skull_Zygomatic_L: [-0.13, 0.016, 0.02],
  Skull_Zygomatic_R: [0.13, 0.016, 0.02],
  Skull_Cheek_L: [-0.1, -0.016, 0.1],
  Skull_Cheek_R: [0.1, -0.016, 0.1],
  Skull_Mastoid_L: [-0.11, -0.024, -0.06],
  Skull_Mastoid_R: [0.11, -0.024, -0.06],
  Skull_Maxilla: [0, -0.04, 0.13],
  Skull_UpperTeeth: [0, -0.072, 0.1],
  Mandible_Body: [0, -0.104, 0.03],
  Mandible_Chin: [0, -0.136, 0.06],
  Mandible_Ramus_L: [-0.08, -0.088, -0.03],
  Mandible_Ramus_R: [0.08, -0.088, -0.03],
  Mandible_LowerTeeth: [0, -0.16, 0.05],
};

export interface SkullLabelDef {
  id: string;
  /** Exact mesh name the leader line anchors to. */
  mesh: string;
  index: string;
  title: string;
}

/**
 * The labelled parts, ordered top → bottom to match their exploded
 * positions, so the right-rail slots never cross their leader lines.
 * Anchors use the camera-facing (+x) side's meshes.
 */
export const SKULL_LABELS: SkullLabelDef[] = [
  { id: "cranium", mesh: "Skull_Cranium", index: "01", title: "Cranium" },
  { id: "orbit", mesh: "Skull_OrbitRim_R", index: "02", title: "Orbit" },
  { id: "zygomatic", mesh: "Skull_Zygomatic_R", index: "03", title: "Zygomatic arch" },
  { id: "nasal", mesh: "Skull_NasalBone_R", index: "04", title: "Nasal bone" },
  { id: "maxilla", mesh: "Skull_Maxilla", index: "05", title: "Maxilla" },
  { id: "teeth", mesh: "Skull_UpperTeeth", index: "06", title: "Teeth" },
  { id: "mandible", mesh: "Mandible_Body", index: "07", title: "Mandible" },
];

function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Explosion amount as a pure function of global scroll progress. The camera
 * zoom lands ~55% through the skull section; the explosion starts once the
 * camera has settled, holds while the labels are read, then reassembles
 * just before the spine section arrives. 0 everywhere outside the skull
 * section.
 */
export function getSkullExplosionFactor(progress: number): number {
  const skull = anatomySections.find((s) => s.id === "skull");
  if (!skull) return 0;
  const span = skull.end - skull.start;
  if (span <= 0) return 0;
  const local = clamp01((clamp01(progress) - skull.start) / span);
  const rampIn = smootherstep((local - 0.5) / 0.28);
  const rampOut = 1 - smootherstep((local - 0.9) / 0.1);
  return rampIn * rampOut;
}

const tmpWorld = new THREE.Vector3();

// Mesh lookup cache — rebuilt only when a new groups object arrives
// (model reload), so the per-frame cost stays at a map lookup.
let cachedGroups: AnatomyGroups | null = null;
const nameToNode = new Map<string, THREE.Object3D>();

function nodeByName(groups: AnatomyGroups, name: string): THREE.Object3D | undefined {
  if (cachedGroups !== groups) {
    cachedGroups = groups;
    nameToNode.clear();
    for (const node of groups.skull) nameToNode.set(node.name, node);
  }
  return nameToNode.get(name);
}

function explodeOffset(node: THREE.Object3D): THREE.Vector3 {
  let v = node.userData.explodeVector as THREE.Vector3 | undefined;
  if (!v) {
    const [x, y, z] = EXPLODE_OFFSETS[node.name] ?? [0, 0, 0];
    v = new THREE.Vector3(x, y, z);
    node.userData.explodeVector = v;
  }
  return v;
}

/**
 * Moves every skull mesh along its explosion vector and publishes the
 * projected screen-space anchors for the leader-line overlay. Called every
 * frame from AnatomyController's useFrame — cheap by design (22 position
 * writes + 7 projections).
 */
export function applySkullExplosion(
  groups: AnatomyGroups,
  factor: number,
  camera: THREE.Camera,
  width: number,
  height: number
): void {
  for (const node of groups.skull) {
    const base = (node.userData.explodeBase ??= node.position.clone()) as THREE.Vector3;
    node.position.copy(base).addScaledVector(explodeOffset(node), factor);
  }

  const st = skullExplosionState;
  st.factor = factor;
  st.width = width;
  st.height = height;
  st.anchors.length = 0;
  for (const def of SKULL_LABELS) {
    const node = nodeByName(groups, def.mesh);
    if (!node) {
      st.anchors.push({ x: 0, y: 0, visible: false });
      continue;
    }
    node.getWorldPosition(tmpWorld);
    tmpWorld.project(camera);
    st.anchors.push({
      x: (tmpWorld.x * 0.5 + 0.5) * width,
      y: (-tmpWorld.y * 0.5 + 0.5) * height,
      visible: tmpWorld.z < 1,
    });
  }
}
