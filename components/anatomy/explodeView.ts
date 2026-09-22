import * as THREE from "three";
import type { AnatomySection } from "./anatomyData";
import { clamp01 } from "./AnatomyTimeline";
import { explosionState } from "@/lib/explosion";
import type { AnatomyGroupKey, AnatomyGroups } from "./anatomyMapping";

export interface ExplodeLabelDef {
  id: string;
  /** Exact mesh name the leader line anchors to. */
  mesh: string;
  /**
   * Optional model-space offset (meters) from the mesh's geometric center.
   * Lets one fused mesh carry several regional labels — e.g. the CT
   * cranium is a single mesh, so "Frontal bone" / "Zygomatic arch" anchor
   * to measured points on it rather than its center.
   */
  anchor?: [number, number, number];
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
 * + mandible + hyoid) is ~0.22 m tall; these spread it to ~0.38 m at full
 * explosion — cranium lifting gently, the mandible dropping and tipping
 * forward as if the jaw is opening, hyoid drifting between them. Kept
 * deliberately modest so the skull reads as articulating, not flying
 * apart (user feedback, 2026-09-22).
 */
const SKULL_OFFSETS: Record<string, [number, number, number]> = {
  Cranium: [0, 0.1, -0.02],
  hyoid: [0, -0.028, 0.055],
  Mandible: [0, -0.06, 0.045],
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
    pullback: 0.26,
    railSide: "right",
    labels: [
      { id: "skull-parietal", mesh: "Cranium", anchor: [0, 0.09, -0.01], index: "01", title: "Parietal bone" },
      { id: "skull-frontal", mesh: "Cranium", anchor: [0, 0.058, 0.058], index: "02", title: "Frontal bone" },
      { id: "skull-zygomatic", mesh: "Cranium", anchor: [0.058, -0.028, 0.028], index: "03", title: "Zygomatic arch" },
      { id: "skull-maxilla", mesh: "Cranium", anchor: [0, -0.072, 0.058], index: "04", title: "Maxilla" },
      { id: "skull-mandible", mesh: "Mandible", index: "05", title: "Mandible" },
      { id: "skull-hyoid", mesh: "hyoid", index: "06", title: "Hyoid bone" },
    ],
  },
  {
    sectionId: "spine",
    groupKey: "spine",
    mode: "radial",
    magnitude: 0.1,
    centroid: [-0.002, 1.316, -0.042],
    pullback: 0.25,
    railSide: "left",
    labels: [
      { id: "spine-c1", mesh: "c1", index: "01", title: "Atlas (C1)" },
      { id: "spine-c2", mesh: "c2", index: "02", title: "Axis (C2)" },
      { id: "spine-c7", mesh: "c7", index: "03", title: "C7 vertebra" },
      { id: "spine-t1", mesh: "t1", index: "04", title: "T1 vertebra" },
      { id: "spine-t6", mesh: "t6", index: "05", title: "T6 vertebra" },
      { id: "spine-t12", mesh: "t12", index: "06", title: "T12 vertebra" },
      { id: "spine-l3", mesh: "l3", index: "07", title: "L3 vertebra" },
      { id: "spine-sacrum", mesh: "Sacrum", index: "08", title: "Sacrum" },
      { id: "spine-coccyx", mesh: "Coccyx", index: "09", title: "Coccyx" },
    ],
  },
  {
    sectionId: "ribCage",
    groupKey: "ribCage",
    mode: "radial",
    magnitude: 0.17,
    centroid: [-0.001, 1.302, -0.01],
    pullback: 0.02,
    railSide: "right",
    labels: [
      { id: "rib-rib2", mesh: "l_rib2", index: "01", title: "2nd rib" },
      { id: "rib-sternum", mesh: "Sternum", index: "02", title: "Sternum" },
      { id: "rib-rib6", mesh: "l_rib6", index: "03", title: "6th rib" },
      { id: "rib-xiphoid", mesh: "Xiphoid_process", index: "04", title: "Xiphoid process" },
      { id: "rib-rib10", mesh: "l_rib10", index: "05", title: "10th rib" },
      { id: "rib-rib12", mesh: "l_rib12", index: "06", title: "12th rib (floating)" },
    ],
  },
  {
    sectionId: "shoulder",
    groupKey: "shoulder",
    mode: "radial",
    magnitude: 0.13,
    centroid: [-0.002, 1.434, -0.016],
    pullback: 0.02,
    railSide: "left",
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
    railSide: "right",
    labels: [
      { id: "arm-humeral-head", mesh: "l_humerus", anchor: [0, 0.14, 0], index: "01", title: "Humeral head" },
      { id: "arm-humerus", mesh: "l_humerus", index: "02", title: "Humerus" },
      { id: "arm-ulna", mesh: "l_ulna", index: "03", title: "Ulna" },
      { id: "arm-radius", mesh: "l_radius", index: "04", title: "Radius" },
    ],
  },
  {
    sectionId: "hand",
    groupKey: "hand",
    mode: "radial",
    magnitude: 0.06,
    centroid: [-0.008, 0.84, 0.016],
    pullback: 0.5,
    railSide: "left",
    labels: [
      { id: "hand-lunate", mesh: "l_lunate", index: "01", title: "Lunate" },
      { id: "hand-scaphoid", mesh: "l_scaphoid", index: "02", title: "Scaphoid" },
      { id: "hand-capitate", mesh: "l_capitate", index: "03", title: "Capitate" },
      { id: "hand-hamate", mesh: "l_hamate", index: "04", title: "Hamate" },
      { id: "hand-metacarpal3", mesh: "l_metacarpal3", index: "05", title: "3rd metacarpal" },
      { id: "hand-proximal", mesh: "l_proximal_phalange3", index: "06", title: "Proximal phalanx" },
      { id: "hand-middle", mesh: "l_intermediate_phalange3", index: "07", title: "Middle phalanx" },
      { id: "hand-distal", mesh: "l_distal_phalange3", index: "08", title: "Distal phalanx" },
    ],
  },
  {
    sectionId: "pelvis",
    groupKey: "pelvis",
    mode: "radial",
    magnitude: 0.15,
    centroid: [-0.002, 0.968, -0.034],
    pullback: 0.02,
    railSide: "right",
    labels: [
      { id: "pelvis-sacrum", mesh: "Sacrum", index: "01", title: "Sacrum" },
      { id: "pelvis-right", mesh: "r_oscoxa", index: "02", title: "Hip bone · right" },
      { id: "pelvis-left", mesh: "l_oscoxa", index: "03", title: "Hip bone · left" },
    ],
  },
  {
    sectionId: "hip",
    groupKey: "hip",
    mode: "radial",
    magnitude: 0.07,
    centroid: [-0.006, 0.722, -0.051],
    pullback: 0.43,
    railSide: "left",
    labels: [
      { id: "hip-femoral-head", mesh: "l_femur", anchor: [0, 0.2, 0], index: "01", title: "Femoral head" },
      { id: "hip-femur", mesh: "l_femur", index: "02", title: "Femur" },
      { id: "hip-femur-r", mesh: "r_femur", index: "03", title: "Femur · right" },
    ],
  },
  {
    sectionId: "knee",
    groupKey: "knee",
    mode: "radial",
    magnitude: 0.08,
    centroid: [-0.006, 0.372, -0.037],
    pullback: 0.71,
    railSide: "right",
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
    railSide: "left",
    labels: [
      { id: "ankle-talus", mesh: "l_talus", index: "01", title: "Talus" },
      { id: "ankle-talus-r", mesh: "r_talus", index: "02", title: "Talus · right" },
    ],
  },
  {
    sectionId: "foot",
    groupKey: "foot",
    mode: "radial",
    magnitude: 0.06,
    centroid: [-0.006, 0.029, 0.058],
    pullback: 0.18,
    railSide: "right",
    labels: [
      { id: "foot-talus", mesh: "l_talus", index: "01", title: "Talus" },
      { id: "foot-navicular", mesh: "l_navicular", index: "02", title: "Navicular" },
      { id: "foot-calcaneus", mesh: "l_calcaneus", index: "03", title: "Calcaneus" },
      { id: "foot-cuneiform", mesh: "l_medial_cuneiform", index: "04", title: "Medial cuneiform" },
      { id: "foot-cuboid", mesh: "l_cuboid", index: "05", title: "Cuboid" },
      { id: "foot-metatarsal3", mesh: "l_metatarsal_3", index: "06", title: "3rd metatarsal" },
      { id: "foot-proximal", mesh: "l_proximal_phalange_1", index: "07", title: "Proximal phalanx" },
      { id: "foot-sesamoids", mesh: "sesamoids", index: "08", title: "Sesamoids" },
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
const tmpAnchor = new THREE.Vector3();

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
    // The anchor rides the mesh's geometric center (plus any regional
    // offset) through its current world transform — explosion included.
    const mc = meshLocalCenter(node);
    const ao = def.anchor;
    tmpAnchor.set(
      mc.x + (ao ? ao[0] : 0),
      mc.y + (ao ? ao[1] : 0),
      mc.z + (ao ? ao[2] : 0)
    );
    tmpWorld.copy(tmpAnchor).applyMatrix4(node.matrixWorld);
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
