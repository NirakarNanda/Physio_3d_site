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
 * Exploded-view offsets per skull mesh, in meters. The skull is ~0.26 m
 * tall; these offsets spread it to ~0.62 m at full explosion. Mostly
 * vertical (the classic technical-illustration axis) with forward/lateral
 * accents so the facial bones fan out toward the viewer, and layered
 * depth (e.g. orbit rim flies further than its socket).
 */
const SKULL_OFFSETS: Record<string, [number, number, number]> = {
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
  Mandible_Ramus_L: [-0.08, -0.088, -0.03],
  Mandible_Ramus_R: [0.08, -0.088, -0.03],
  Mandible_Chin: [0, -0.136, 0.06],
  Mandible_LowerTeeth: [0, -0.16, 0.05],
};

/**
 * One exploded view per anatomy section. Magnitudes and pullbacks were
 * solved headlessly against the shipped camera keyframes (see
 * /tmp/qa_explode_v2.py): at full explosion every part stays inside
 * |NDC x/y| ≤ 0.93 on a 16:9 viewport.
 */
const EXPLODE_CONFIGS: ExplodeSectionConfig[] = [
  {
    sectionId: "skull",
    groupKey: "skull",
    mode: "offsets",
    offsets: SKULL_OFFSETS,
    magnitude: 0,
    centroid: [0, 1.6191, 0.0445],
    pullback: 0.32,
    railSide: "left",
    labels: [
      { id: "skull-cranium", mesh: "Skull_Cranium", index: "01", title: "Cranium" },
      { id: "skull-orbit", mesh: "Skull_OrbitRim_R", index: "02", title: "Orbit" },
      { id: "skull-zygomatic", mesh: "Skull_Zygomatic_R", index: "03", title: "Zygomatic arch" },
      { id: "skull-nasal", mesh: "Skull_NasalBone_R", index: "04", title: "Nasal bone" },
      { id: "skull-maxilla", mesh: "Skull_Maxilla", index: "05", title: "Maxilla" },
      { id: "skull-teeth", mesh: "Skull_UpperTeeth", index: "06", title: "Teeth" },
      { id: "skull-mandible", mesh: "Mandible_Body", index: "07", title: "Mandible" },
    ],
  },
  {
    sectionId: "spine",
    groupKey: "spine",
    mode: "separation",
    magnitude: 0.12,
    centroid: [0, 1.2115, -0.0177],
    pullback: 0.12,
    railSide: "right",
    labels: [
      { id: "spine-cervical", mesh: "Vertebra_C4", index: "01", title: "Cervical vertebrae" },
      { id: "spine-thoracic", mesh: "Vertebra_T6", index: "02", title: "Thoracic vertebrae" },
      { id: "spine-lumbar", mesh: "Vertebra_L3", index: "03", title: "Lumbar vertebrae" },
      { id: "spine-sacrum", mesh: "Sacrum", index: "04", title: "Sacrum" },
    ],
  },
  {
    sectionId: "ribCage",
    groupKey: "ribCage",
    mode: "radial",
    magnitude: 0.17,
    centroid: [0, 1.2649, 0.0618],
    pullback: 0.02,
    railSide: "left",
    labels: [
      { id: "rib-sternum", mesh: "Sternum", index: "01", title: "Sternum" },
      { id: "rib-cartilage", mesh: "CostalCartilage_04_R", index: "02", title: "Costal cartilage" },
      { id: "rib-ribs", mesh: "Rib_06_R", index: "03", title: "Ribs" },
    ],
  },
  {
    sectionId: "shoulder",
    groupKey: "shoulder",
    mode: "separation",
    magnitude: 0.13,
    centroid: [0, 1.4037, -0.0179],
    pullback: 0.02,
    railSide: "right",
    labels: [
      { id: "shoulder-clavicle", mesh: "Clavicle_R", index: "01", title: "Clavicle" },
      { id: "shoulder-scapula", mesh: "Scapula_R", index: "02", title: "Scapula" },
    ],
  },
  {
    sectionId: "arm",
    groupKey: "arm",
    mode: "separation",
    magnitude: 0.1,
    centroid: [0, 1.1736, 0.0008],
    pullback: 0.68,
    railSide: "left",
    labels: [
      { id: "arm-humerus", mesh: "Humerus_R", index: "01", title: "Humerus" },
      { id: "arm-radius", mesh: "Radius_R", index: "02", title: "Radius" },
      { id: "arm-ulna", mesh: "Ulna_R", index: "03", title: "Ulna" },
    ],
  },
  {
    sectionId: "hand",
    groupKey: "hand",
    mode: "radial",
    magnitude: 0.06,
    centroid: [0, 0.7425, 0.0104],
    pullback: 0.25,
    railSide: "right",
    labels: [
      { id: "hand-carpals", mesh: "Carpal_R_01", index: "01", title: "Carpals" },
      { id: "hand-metacarpals", mesh: "Metacarpal_R_02", index: "02", title: "Metacarpals" },
      { id: "hand-phalanges", mesh: "Finger_R_2_Phalanx_2", index: "03", title: "Phalanges" },
    ],
  },
  {
    sectionId: "pelvis",
    groupKey: "pelvis",
    mode: "separation",
    magnitude: 0.15,
    centroid: [0, 0.8658, 0.0239],
    pullback: 0.02,
    railSide: "left",
    labels: [
      { id: "pelvis-ilium", mesh: "Pelvis_Ilium_L", index: "01", title: "Ilium" },
      { id: "pelvis-ischium", mesh: "Pelvis_Ischium_L", index: "02", title: "Ischium" },
      { id: "pelvis-pubis", mesh: "Pelvis_Pubis_L", index: "03", title: "Pubis" },
    ],
  },
  {
    sectionId: "hip",
    groupKey: "hip",
    mode: "radial",
    magnitude: 0.07,
    centroid: [0, 0.8115, 0.0035],
    pullback: 0.43,
    railSide: "right",
    labels: [
      { id: "hip-head", mesh: "Femoral_Head_R", index: "01", title: "Femoral head" },
      { id: "hip-trochanter", mesh: "Hip_Femur_Trochanter_R", index: "02", title: "Greater trochanter" },
      { id: "hip-femur", mesh: "Hip_Femur_R", index: "03", title: "Femur" },
    ],
  },
  {
    sectionId: "knee",
    groupKey: "knee",
    mode: "separation",
    magnitude: 0.08,
    centroid: [0, 0.3653, 0.0129],
    pullback: 0.71,
    railSide: "left",
    labels: [
      { id: "knee-femur", mesh: "Knee_Distal_Femur_R", index: "01", title: "Femur" },
      { id: "knee-patella", mesh: "Patella_R", index: "02", title: "Patella" },
      { id: "knee-tibia", mesh: "Knee_Proximal_Tibia_R", index: "03", title: "Tibia" },
      { id: "knee-fibula", mesh: "Knee_Fibula_R", index: "04", title: "Fibula" },
    ],
  },
  {
    sectionId: "ankle",
    groupKey: "ankle",
    mode: "radial",
    magnitude: 0.07,
    centroid: [0, 0.0903, 0.0047],
    pullback: 0.02,
    railSide: "right",
    labels: [
      { id: "ankle-tibia", mesh: "Distal_Tibia_R", index: "01", title: "Tibia" },
      { id: "ankle-fibula", mesh: "Distal_Fibula_R", index: "02", title: "Fibula" },
      { id: "ankle-talus", mesh: "Talus_R", index: "03", title: "Talus" },
    ],
  },
  {
    sectionId: "foot",
    groupKey: "foot",
    mode: "radial",
    magnitude: 0.06,
    centroid: [0, 0.0302, 0.0985],
    pullback: 0.18,
    railSide: "left",
    labels: [
      { id: "foot-tarsals", mesh: "Tarsal_R_01", index: "01", title: "Tarsals" },
      { id: "foot-metatarsals", mesh: "Metatarsal_R_03", index: "02", title: "Metatarsals" },
      { id: "foot-phalanges", mesh: "Toe_R_03", index: "03", title: "Phalanges" },
      { id: "foot-calcaneus", mesh: "Calcaneus_R", index: "04", title: "Calcaneus" },
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
