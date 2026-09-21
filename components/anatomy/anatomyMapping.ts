import * as THREE from "three";

export type AnatomyGroupKey =
  | "skull"
  | "spine"
  | "ribCage"
  | "shoulder"
  | "arm"
  | "hand"
  | "pelvis"
  | "hip"
  | "knee"
  | "ankle"
  | "foot";

export const ANATOMY_GROUP_KEYS: AnatomyGroupKey[] = [
  "skull",
  "spine",
  "ribCage",
  "shoulder",
  "arm",
  "hand",
  "pelvis",
  "hip",
  "knee",
  "ankle",
  "foot",
];

export type AnatomyGroups = Record<AnatomyGroupKey, THREE.Object3D[]>;

/**
 * Keyword patterns used to auto-classify mesh/bone names from common
 * anatomical GLB exports (Sketchfab medical models, BioDigital exports,
 * generic "Human Anatomy" asset packs, etc).
 *
 * THIS IS THE ONLY PLACE MESH-NAME ASSUMPTIONS LIVE. If your skeleton.glb
 * uses different naming, either add patterns here or pass an `overrides`
 * map to buildAnatomyGroups() with exact mesh names — overrides always win.
 */
export const ANATOMY_KEYWORDS: Record<AnatomyGroupKey, RegExp[]> = {
  skull: [/skull/i, /cranium/i, /mandible/i, /^jaw/i, /head[_-]?bone/i],
  spine: [
    /spine/i,
    /vertebra/i,
    /vertebrae/i,
    /cervical/i,
    /lumbar/i,
    /sacrum/i,
    /coccyx/i,
    /^c[1-7]$/i,
    /^t[1-9]$|^t1[0-2]$/i,
    /^l[1-5]$/i,
  ],
  ribCage: [/rib/i, /sternum/i, /thora(c|x)/i, /costal/i],
  shoulder: [/clavicle/i, /scapula/i, /shoulder/i],
  arm: [/humerus/i, /radius/i, /ulna/i, /forearm/i, /(^|[_-])arm([_-]|$)/i],
  hand: [
    /carpal/i,
    /metacarpal/i,
    /phalan(x|ge)/i,
    /(^|[_-])hand([_-]|$)/i,
    /finger/i,
    /thumb/i,
  ],
  pelvis: [/pelvis/i, /pelvic/i, /ilium/i, /ischium/i, /pubis/i],
  hip: [/hip/i, /femur[_-]?head/i, /femoral[_-]?head/i, /acetabulum/i],
  knee: [
    /knee/i,
    /patella/i,
    /distal[_-]?femur/i,
    /proximal[_-]?tibia/i,
    /tibial[_-]?plateau/i,
  ],
  ankle: [/ankle/i, /talus/i, /distal[_-]?tibia/i, /distal[_-]?fibula/i, /malleolus/i],
  foot: [
    /tarsal/i,
    /metatarsal/i,
    /calcaneus/i,
    /(^|[_-])foot([_-]|$)/i,
    /toe/i,
  ],
};

export interface BuildAnatomyGroupsResult {
  groups: AnatomyGroups;
  /** Meshes that didn't match any keyword — surfaced for debugging in dev. */
  unassigned: THREE.Object3D[];
}

/**
 * Walks the loaded GLTF scene graph and buckets every mesh into an
 * anatomy group. Explicit `overrides` (exact node names) always win over
 * keyword matching, so this function degrades gracefully for any model:
 * a model with clean per-bone naming gets full per-region highlighting,
 * a model exported as one fused mesh still renders (just with less
 * granular highlighting), and nothing throws either way.
 */
export function buildAnatomyGroups(
  root: THREE.Object3D,
  overrides?: Partial<Record<AnatomyGroupKey, string[]>>
): BuildAnatomyGroupsResult {
  const groups = ANATOMY_GROUP_KEYS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as AnatomyGroups);

  const overrideLookup = new Map<string, AnatomyGroupKey>();
  if (overrides) {
    (Object.keys(overrides) as AnatomyGroupKey[]).forEach((key) => {
      overrides[key]?.forEach((name) => overrideLookup.set(name.toLowerCase(), key));
    });
  }

  const unassigned: THREE.Object3D[] = [];

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) && !(node instanceof THREE.SkinnedMesh)) return;

    const name = node.name || "";
    const lower = name.toLowerCase();

    const overrideMatch = overrideLookup.get(lower);
    if (overrideMatch) {
      groups[overrideMatch].push(node);
      return;
    }

    let matched: AnatomyGroupKey | null = null;
    for (const key of ANATOMY_GROUP_KEYS) {
      if (ANATOMY_KEYWORDS[key].some((pattern) => pattern.test(name))) {
        matched = key;
        break;
      }
    }

    if (matched) {
      groups[matched].push(node);
    } else {
      unassigned.push(node);
    }
  });

  return { groups, unassigned };
}

/** All meshes across every group, flattened — used for "return to full body" states. */
export function flattenGroups(groups: AnatomyGroups): THREE.Object3D[] {
  return ANATOMY_GROUP_KEYS.flatMap((key) => groups[key]);
}
