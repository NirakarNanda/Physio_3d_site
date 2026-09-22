import * as THREE from "three";
import type { AnatomySection } from "./anatomyData";
import { clamp01 } from "./AnatomyTimeline";
import { explosionState } from "@/lib/explosion";
import type { AnatomyGroupKey, AnatomyGroups } from "./anatomyMapping";

export interface ExplodeLabelDef {
  id: string;
  /** Exact mesh name the leader line anchors to. */
  mesh: string;
  index: string;
  title: string;
}

/**
 * How a section's parts travel when it explodes:
 * - "offsets": per-mesh authored vectors (the hand-tuned skull table).
 * - "separation": the GLB's per-mesh separationOffset direction, normalized
 *   and scaled by `magnitude` (falls back to radial for meshes without one).
 * - "radial": straight out from the group's centroid — the classic burst,
 *   used where the authored directions are too uniform to read as an
 *   explosion (hand, rib cage, …).
 */
export type ExplodeMode = "offsets" | "separation" | "radial";

export interface ExplodeSectionConfig {
  sectionId: string;
  groupKey: AnatomyGroupKey;
  mode: ExplodeMode;
  /** Authored per-mesh vectors, in meters (mode "offsets" only). */
  offsets?: Record<string, [number, number, number]>;
  /** Meters of travel for "separation" / "radial" modes. */
  magnitude: number;
  /**
   * Model-space centroid of the group, for the radial direction
   * (meshCenter − centroid). Precomputed from the GLB — the node origins
   * all sit at (0,0,0) with baked geometry, so this cannot be derived from
   * node positions at runtime.
   */
  centroid: [number, number, number];
  labels: ExplodeLabelDef[];
  /** Which screen edge the label rail sits on (opposite the text panel). */
  railSide: "left" | "right";
  /**
   * Camera dolly at full explosion: distanceScale *= 1 + pullback * factor.
   * Verified headlessly per section so the exploded parts stay in frame
   * (max |NDC x/y| ≤ 0.93 at factor 1, 16:9).
   */
  pullback: number;
}

/**
 * Exploded-view offsets per skull mesh, in meters. The CT skull (cranium
 * + mandible + hyoid) is ~0.22 m tall; these spread it to ~0.55 m at full
 * explosion — cranium up and slightly back, mandible down and forward,
 * hyoid drifting forward between them.
 */
const SKULL_OFFSETS: Record<string, [number, number, number]> = {
  Cranium: [0, 0.16, -0.03],
  hyoid: [0, -0.05, 0.1],
  Mandible: [0, -0.13, 0.06],
};

/**
 * One exploded view per anatomy section. Magnitudes and pullbacks were
 * solved headlessly against the CT skeleton's real bone bounding boxes and
 * the shipped camera keyframes (see ~/workspace/physio-skeleton-work/qa_tune.py):
 * at full explosion every part stays inside |NDC x/y| ≤ 0.93 on a 16:9
 * viewport. All sections use radial mode (the CT export carries no
 * per-mesh separation vectors); the skull keeps authored offsets.
 */
const EXPLODE_CONFIGS: ExplodeSectionConfig[] = [
  {
    sectionId: "skull",
    groupKey: "skull",
    mode: "offsets",
    offsets: SKULL_OFFSETS,
    magnitude: 0,
    centroid: [0.005, 1.56, 0.059],
    pullback: 0.4,
    railSide: "left",
    labels: [
      { id: "skull-cranium", mesh: "Cranium", index: "01", title: "Cranium" },
      { id: "skull-hyoid", mesh: "hyoid", index: "02", title: "Hyoid bone" },
      { id: "skull-mandible", mesh: "Mandible", index: "03", title: "Mandible" },
    ],
  },
  {
    sectionId: "spine",
    groupKey: "spine",
    mode: "radial",
    magnitude: 0.1,
    centroid: [-0.002, 1.316, -0.042],
    pullback: 0.25,
    railSide: "right",
    labels: [
      { id: "spine-cervical", mesh: "c4", index: "01", title: "Cervical vertebrae" },
      { id: "spine-thoracic", mesh: "t6", index: "02", title: "Thoracic vertebrae" },
      { id: "spine-lumbar", mesh: "l3", index: "03", title: "Lumbar vertebrae" },
      { id: "spine-sacrum", mesh: "Sacrum", index: "04", title: "Sacrum" },
    ],
  },
  {
    sectionId: "ribCage",
    groupKey: "ribCage",
    mode: "radial",
    magnitude: 0.17,
    centroid: [-0.001, 1.302, -0.01],
    pullback: 0.02,
    railSide: "left",
    labels: [
      { id: "rib-sternum", mesh: "Sternum", index: "01", title: "Sternum" },
      { id: "rib-xiphoid", mesh: "Xiphoid_process", index: "02", title: "Xiphoid process" },
      { id: "rib-ribs", mesh: "l_rib6", index: "03", title: "Ribs" },
    ],
  },
  {
    sectionId: "shoulder",
    groupKey: "shoulder",
    mode: "radial",
    magnitude: 0.13,
    centroid: [-0.002, 1.434, -0.016],
    pullback: 0.02,
    railSide: "right",
    labels: [
      { id: "shoulder-clavicle", mesh: "l_clavicle", index: "01", title: "Clavicle" },
      { id: "shoulder-scapula", mesh: "l_scapula", index: "02", title: "Scapula" },
    ],
  },
  {
    sectionId: "arm",
    groupKey: "arm",
    mode: "radial",
    magnitude: 0.1,
    centroid: [-0.005, 1.134, -0.02],
    pullback: 0.68,
    railSide: "left",
    labels: [
      { id: "arm-humerus", mesh: "l_humerus", index: "01", title: "Humerus" },
      { id: "arm-radius", mesh: "l_radius", index: "02", title: "Radius" },
      { id: "arm-ulna", mesh: "l_ulna", index: "03", title: "Ulna" },
    ],
  },
  {
    sectionId: "hand",
    groupKey: "hand",
    mode: "radial",
    magnitude: 0.06,
    centroid: [-0.008, 0.84, 0.016],
    pullback: 0.5,
    railSide: "right",
    labels: [
      { id: "hand-carpals", mesh: "l_lunate", index: "01", title: "Carpals" },
      { id: "hand-metacarpals", mesh: "l_metacarpal3", index: "02", title: "Metacarpals" },
      { id: "hand-phalanges", mesh: "l_proximal_phalange3", index: "03", title: "Phalanges" },
    ],
  },
  {
    sectionId: "pelvis",
    groupKey: "pelvis",
    mode: "radial",
    magnitude: 0.15,
    centroid: [-0.002, 0.968, -0.034],
    pullback: 0.02,
    railSide: "left",
    labels: [
      { id: "pelvis-left", mesh: "l_oscoxa", index: "01", title: "Hip bone (left)" },
      { id: "pelvis-right", mesh: "r_oscoxa", index: "02", title: "Hip bone (right)" },
    ],
  },
  {
    sectionId: "hip",
    groupKey: "hip",
    mode: "radial",
    magnitude: 0.07,
    centroid: [-0.006, 0.722, -0.051],
    pullback: 0.43,
    railSide: "right",
    labels: [
      { id: "hip-left", mesh: "l_femur", index: "01", title: "Femur (left)" },
      { id: "hip-right", mesh: "r_femur", index: "02", title: "Femur (right)" },
    ],
  },
  {
    sectionId: "knee",
    groupKey: "knee",
    mode: "radial",
    magnitude: 0.08,
    centroid: [-0.006, 0.372, -0.037],
    pullback: 0.71,
    railSide: "left",
    labels: [
      { id: "knee-patella", mesh: "l_patella", index: "01", title: "Patella" },
      { id: "knee-tibia", mesh: "l_tibia", index: "02", title: "Tibia" },
      { id: "knee-fibula", mesh: "l_fibula", index: "03", title: "Fibula" },
    ],
  },
  {
    sectionId: "ankle",
    groupKey: "ankle",
    mode: "radial",
    magnitude: 0.07,
    centroid: [-0.006, 0.1, -0.03],
    pullback: 0.02,
    railSide: "right",
    labels: [
      { id: "ankle-left", mesh: "l_talus", index: "01", title: "Talus (left)" },
      { id: "ankle-right", mesh: "r_talus", index: "02", title: "Talus (right)" },
    ],
  },
  {
    sectionId: "foot",
    groupKey: "foot",
    mode: "radial",
    magnitude: 0.06,
    centroid: [-0.006, 0.029, 0.058],
    pullback: 0.18,
    railSide: "left",
    labels: [
      { id: "foot-calcaneus", mesh: "l_calcaneus", index: "01", title: "Calcaneus" },
      { id: "foot-tarsals", mesh: "l_navicular", index: "02", title: "Tarsals" },
      { id: "foot-metatarsals", mesh: "l_metatarsal_3", index: "03", title: "Metatarsals" },
      { id: "foot-phalanges", mesh: "l_distal_phalange_3", index: "04", title: "Phalanges" },
    ],
  },
];

export function getExplodeConfig(sectionId: string): ExplodeSectionConfig | undefined {
  return EXPLODE_CONFIGS.find((c) => c.sectionId === sectionId);
}

function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Explosion amount as a pure function of global scroll progress. The camera
 * zoom lands ~55% through the section; the explosion starts once the camera
 * has mostly settled, holds while the labels are read, then reassembles
 * just before the next section arrives. 0 everywhere outside the section.
 */
export function getExplosionFactor(progress: number, section: AnatomySection): number {
  const span = section.end - section.start;
  if (span <= 0) return 0;
  const local = clamp01((clamp01(progress) - section.start) / span);
  const rampIn = smootherstep((local - 0.5) / 0.28);
  const rampOut = 1 - smootherstep((local - 0.9) / 0.1);
  return rampIn * rampOut;
}

/**
 * Geometric center of a mesh in model space. The GLB bakes every transform
 * into the vertex data (all node origins sit at 0,0,0), so the local
 * bounding-box center IS the assembled model-space center regardless of the
 * node's current position. Cached per node — computed once.
 */
function meshLocalCenter(node: THREE.Object3D): THREE.Vector3 {
  let c = node.userData.meshCenter as THREE.Vector3 | undefined;
  if (!c) {
    const geo = (node as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (geo) {
      geo.computeBoundingBox();
      c = geo.boundingBox ? geo.boundingBox.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    } else {
      c = new THREE.Vector3();
    }
    node.userData.meshCenter = c;
  }
  return c;
}

/**
 * Writes this node's explosion travel vector (at factor 1) into `out`.
 * Allocation-free per frame; the only per-node cost is a few arithmetic
 * ops plus the one-time bbox computation.
 */
export function writeExplodeVector(
  out: THREE.Vector3,
  node: THREE.Object3D,
  cfg: ExplodeSectionConfig
): void {
  if (cfg.mode === "offsets") {
    const o = cfg.offsets?.[node.name];
    out.set(o ? o[0] : 0, o ? o[1] : 0, o ? o[2] : 0);
    return;
  }
  if (cfg.mode === "separation") {
    const raw = node.userData.separationOffset as [number, number, number] | undefined;
    if (raw) {
      out.set(raw[0], raw[1], raw[2]);
      const len = out.length();
      if (len > 1e-6) {
        out.multiplyScalar(cfg.magnitude / len);
        return;
      }
    }
    // Meshes without an authored direction (e.g. Pelvis_Symphysis) fall
    // through to the radial burst below.
  }
  const c = meshLocalCenter(node);
  out.set(c.x - cfg.centroid[0], c.y - cfg.centroid[1], c.z - cfg.centroid[2]);
  const len = out.length();
  if (len > 1e-6) out.multiplyScalar(cfg.magnitude / len);
  else out.set(0, cfg.magnitude, 0);
}

const tmpWorld = new THREE.Vector3();

// Mesh lookup cache — rebuilt only when a new groups object (or group key)
// arrives, so the per-frame cost stays at a map lookup.
let cachedGroups: AnatomyGroups | null = null;
let cachedKey: AnatomyGroupKey | null = null;
const nameToNode = new Map<string, THREE.Object3D>();

function nodeByName(
  groups: AnatomyGroups,
  groupKey: AnatomyGroupKey,
  name: string
): THREE.Object3D | undefined {
  if (cachedGroups !== groups || cachedKey !== groupKey) {
    cachedGroups = groups;
    cachedKey = groupKey;
    nameToNode.clear();
    for (const node of groups[groupKey]) nameToNode.set(node.name, node);
  }
  return nameToNode.get(name);
}

/**
 * Publishes the projected screen-space anchors for the leader-line overlay.
 * Anchors track the mesh's geometric center through its current world
 * transform (explosion offset included) — called after the emphasis pass so
 * positions are final for this frame.
 */
export function publishExplosionAnchors(
  groups: AnatomyGroups,
  cfg: ExplodeSectionConfig,
  camera: THREE.Camera,
  width: number,
  height: number,
  factor: number
): void {
  const st = explosionState;
  st.factor = factor;
  st.sectionId = cfg.sectionId;
  st.width = width;
  st.height = height;
  st.anchors.length = 0;
  for (const def of cfg.labels) {
    const node = nodeByName(groups, cfg.groupKey, def.mesh);
    if (!node) {
      st.anchors.push({ x: 0, y: 0, visible: false });
      continue;
    }
    node.updateWorldMatrix(true, false);
    tmpWorld.copy(meshLocalCenter(node)).applyMatrix4(node.matrixWorld);
    tmpWorld.project(camera);
    st.anchors.push({
      x: (tmpWorld.x * 0.5 + 0.5) * width,
      y: (-tmpWorld.y * 0.5 + 0.5) * height,
      visible: tmpWorld.z < 1,
    });
  }
}

export function resetExplosionState(): void {
  explosionState.factor = 0;
  explosionState.sectionId = null;
  explosionState.anchors.length = 0;
}
