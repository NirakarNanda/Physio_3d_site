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
 * Keyword patterns used to auto-classify mesh/bone names from anatomical
 * GLB exports. Covers two naming conventions:
 *  - the CT-derived skeleton (Terrie Simmons-Ehrhardt, CC-BY): clean bone
 *    names like "Cranium", "l_femur", "c4", "l_metacarpal3",
 *    "l_distal_phalange_1" (foot) vs "l_distal_phalange1" (hand — no
 *    underscore before the number), "l_oscoxa", "sesamoids"
 *  - generic procedural/Sketchfab packs: "Skull_Cranium", "Vertebra_C4",
 *    "Femoral_Head_R", "Knee_Distal_Femur_R", …
 *
 * THIS IS THE ONLY PLACE MESH-NAME ASSUMPTIONS LIVE. If your skeleton.glb
 * uses different naming, either add patterns here or pass an `overrides`
 * map to buildAnatomyGroups() with exact mesh names — overrides always win.
 */
export const ANATOMY_KEYWORDS: Record<AnatomyGroupKey, RegExp[]> = {
  skull: [/skull/i, /cranium/i, /mandible/i, /^jaw/i, /hyoid/i, /head[_-]?bone/i],
  spine: [
    /spine/i,
    /vertebra/i,
    /cervical/i,
    /thoracic/i,
    /lumbar/i,
    /sacrum/i,
    /coccyx/i,
    /^c[1-7]$/i,
    /^t(1[0-2]|[1-9])$/i,
    /^l[1-5]$/i,
  ],
  ribCage: [/rib/i, /sternum/i, /xiphoid/i, /thora(c|x)/i, /costal/i, /costa/i],
  shoulder: [/clavicle/i, /scapula/i, /shoulder/i],
  arm: [/humerus/i, /radius/i, /ulna/i, /forearm/i, /(^|[_-])arm([_-]|$)/i],
  hand: [
    /carpal/i,
    /metacarpal/i,
    /capitate/i,
    /hamate/i,
    /lunate/i,
    /pisiform/i,
    /scaphoid/i,
    /trapezium/i,
    /trapezoid/i,
    /triquetr/i,
    /sesamoid/i,
    // Hand phalanges are named "…phalange1" (digit directly after);
    // foot phalanges are "…phalange_1" (underscore) — see foot below.
    /phalange\d/i,
    /phalanx/i,
    /(^|[_-])hand([_-]|$)/i,
    /finger/i,
    /thumb/i,
  ],
  pelvis: [/pelvis/i, /pelvic/i, /os[_-]?coxa/i, /ilium/i, /ischium/i, /pubis/i],
  hip: [/hip/i, /femur/i, /femoral/i, /acetabulum/i],
  knee: [/knee/i, /patella/i, /tibia/i, /fibula/i, /tibial[_-]?plateau/i],
  ankle: [/ankle/i, /talus/i, /malleolus/i],
  foot: [
    /tarsal/i,
    /metatarsal/i,
    /calcaneus/i,
    /cuboid/i,
    /navicular/i,
    /cuneiform/i,
    /phalange_\d/i,
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
      const names = overrides[key];
      // Tolerate a lone string (a common caller slip) instead of crashing.
      (Array.isArray(names) ? names : names ? [names] : []).forEach((name) =>
        overrideLookup.set(name.toLowerCase(), key)
      );
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
