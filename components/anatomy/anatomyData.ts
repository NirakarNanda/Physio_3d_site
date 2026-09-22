import type { AnatomyGroupKey } from "./anatomyMapping";

export type Vec3 = [number, number, number];

export interface AnatomySection {
  /** Stable identifier — also used as the React key and for QA/analytics. */
  id: string;
  /** Small uppercase label, e.g. "01 / SKULL". Empty string for intro/outro. */
  eyebrow: string;
  /** Large editorial heading. Each array entry renders on its own line. */
  title: string[];
  /** One or two sentence supporting copy. Keep concise per brief. */
  description: string;
  /** Scroll progress range this section owns, as fractions of the pinned track [0..1]. */
  start: number;
  end: number;
  /** Which anatomy groups brighten/scale up while this section is active. Empty = full body. */
  highlightGroups: AnatomyGroupKey[];
  /** Camera position in world space (meters, human ~1.75 tall standing at origin). */
  cameraPosition: Vec3;
  /** Point the camera looks at. */
  cameraTarget: Vec3;
  /** Whether highlighted bones should subtly separate to reveal joint structure. */
  separate: boolean;
  /** Which side the text panel renders on, alternated for editorial rhythm. */
  textSide: "left" | "right" | "center";
  /**
   * Key anatomical structures labelled when this section is zoomed in.
   * Rendered as small chips under the description in AnatomyLabels.
   * Empty for intro/outro.
   */
  keyStructures: string[];
}

/**
 * The entire anatomy scroll-story lives here. AnatomyTimeline.ts and
 * AnatomyController.tsx are pure consumers of this array — nothing about
 * camera movement, highlighting, or copy is hardcoded anywhere else.
 *
 * Progress ranges follow the brief's spec exactly (Section 7). Camera
 * positions/targets are tuned for a ~1.75m-tall standing rig centered at
 * the world origin with feet at y=0 and the model facing +Z. If your
 * skeleton.glb uses a different scale or origin, adjust MODEL_SCALE /
 * MODEL_Y_OFFSET in AnatomyScene.tsx first — the ratios here should still
 * roughly hold.
 */
export const anatomySections: AnatomySection[] = [
  {
    id: "intro",
    eyebrow: "",
    title: ["THE HUMAN FRAME"],
    description: "The foundation of movement.",
    start: 0.0,
    end: 0.08,
    highlightGroups: [],
    cameraPosition: [0, 1.05, 4.4],
    // Look-target shifted left so the full-body skeleton sits in the right
    // of frame — the bookend text panel lives on the left and must never
    // cover the bones (Section: intro/outro overlap fix).
    cameraTarget: [-0.5, 0.95, 0],
    separate: false,
    textSide: "left",
    keyStructures: [],
  },
  {
    id: "skull",
    eyebrow: "01 / SKULL",
    title: ["SKULL"],
    description:
      "Protects the brain and forms the structural foundation of the face.",
    start: 0.08,
    end: 0.16,
    highlightGroups: ["skull"],
    cameraPosition: [0.42, 1.63, 0.88],
    cameraTarget: [0, 1.655, 0.01],
    separate: false,
    textSide: "left",
    keyStructures: ["Cranium", "Mandible", "Hyoid bone"],
  },
  {
    id: "spine",
    eyebrow: "02 / VERTEBRAL COLUMN",
    title: ["VERTEBRAL", "COLUMN"],
    description:
      "Supports the body while protecting the spinal cord and allowing controlled movement.",
    start: 0.16,
    end: 0.27,
    highlightGroups: ["spine"],
    cameraPosition: [-0.65, 1.25, 1.55],
    cameraTarget: [0, 1.15, 0],
    separate: true,
    textSide: "right",
    keyStructures: ["Cervical ×7", "Thoracic ×12", "Lumbar ×5", "Sacrum"],
  },
  {
    id: "ribCage",
    eyebrow: "03 / THORACIC CAGE",
    title: ["THORACIC", "CAGE"],
    description:
      "Creates a protective framework around the heart and lungs while supporting breathing mechanics.",
    start: 0.27,
    end: 0.37,
    highlightGroups: ["ribCage"],
    cameraPosition: [0.7, 1.3, 1.7],
    cameraTarget: [0, 1.28, 0],
    separate: true,
    textSide: "left",
    keyStructures: ["12 rib pairs", "Sternum", "Xiphoid process"],
  },
  {
    id: "shoulder",
    eyebrow: "04 / SHOULDER",
    title: ["SHOULDER"],
    description:
      "A complex system designed for stability, mobility and a wide range of upper-limb movement.",
    start: 0.37,
    end: 0.47,
    highlightGroups: ["shoulder"],
    cameraPosition: [0.85, 1.5, 1.1],
    cameraTarget: [0.28, 1.45, 0],
    separate: true,
    textSide: "right",
    keyStructures: ["Clavicle", "Scapula"],
  },
  {
    id: "arm",
    eyebrow: "05 / UPPER LIMB",
    title: ["UPPER", "LIMB"],
    description:
      "Three major bones work together to create controlled movement from the shoulder to the wrist.",
    start: 0.47,
    end: 0.56,
    highlightGroups: ["arm"],
    cameraPosition: [0.95, 1.05, 1.0],
    cameraTarget: [0.38, 1.05, 0],
    separate: true,
    textSide: "left",
    keyStructures: ["Humerus", "Radius", "Ulna"],
  },
  {
    id: "hand",
    eyebrow: "06 / HAND",
    title: ["HAND"],
    description:
      "A finely structured system built for precision, grip and controlled movement.",
    start: 0.56,
    end: 0.63,
    highlightGroups: ["hand"],
    cameraPosition: [0.85, 0.72, 0.65],
    cameraTarget: [0.42, 0.72, 0],
    separate: true,
    textSide: "right",
    keyStructures: ["Carpals", "Metacarpals", "Phalanges"],
  },
  {
    id: "pelvis",
    eyebrow: "07 / PELVIS",
    title: ["PELVIS"],
    description:
      "The central connection between the spine and lower limbs, providing stability and transferring load.",
    start: 0.63,
    end: 0.72,
    highlightGroups: ["pelvis"],
    cameraPosition: [-0.6, 0.95, 1.35],
    cameraTarget: [0, 0.9, 0],
    separate: false,
    textSide: "left",
    keyStructures: ["Hip bones", "Sacrum"],
  },
  {
    id: "hip",
    eyebrow: "08 / HIP",
    title: ["HIP"],
    description:
      "A powerful ball-and-socket joint balancing stability with mobility.",
    start: 0.72,
    end: 0.79,
    highlightGroups: ["hip"],
    cameraPosition: [0.55, 0.88, 0.95],
    cameraTarget: [0.16, 0.86, 0],
    separate: true,
    textSide: "right",
    keyStructures: ["Femur", "Hip joint"],
  },
  {
    id: "knee",
    eyebrow: "09 / KNEE",
    title: ["KNEE"],
    description: "A weight-bearing joint that connects mobility with stability.",
    start: 0.79,
    end: 0.87,
    highlightGroups: ["knee"],
    cameraPosition: [0.5, 0.48, 0.85],
    cameraTarget: [0.13, 0.46, 0],
    separate: true,
    textSide: "left",
    keyStructures: ["Patella", "Tibia", "Fibula"],
  },
  {
    id: "ankle",
    eyebrow: "10 / ANKLE",
    title: ["ANKLE"],
    description:
      "A precise connection between the lower leg and foot that supports balance and movement.",
    start: 0.87,
    end: 0.93,
    highlightGroups: ["ankle"],
    cameraPosition: [0.4, 0.16, 0.7],
    cameraTarget: [0.11, 0.12, 0],
    separate: false,
    textSide: "right",
    keyStructures: ["Talus", "Ankle joint"],
  },
  {
    id: "foot",
    eyebrow: "11 / FOOT",
    title: ["FOOT"],
    description: "A foundation for balance, stability and movement.",
    start: 0.93,
    end: 0.97,
    highlightGroups: ["foot"],
    cameraPosition: [0.35, 0.1, 0.65],
    cameraTarget: [0.11, 0.03, 0],
    separate: false,
    textSide: "left",
    keyStructures: ["Tarsals", "Metatarsals", "Phalanges"],
  },
  {
    id: "outro",
    eyebrow: "UNDERSTANDING MOVEMENT",
    title: ["BONES → JOINTS →", "MUSCLES → MOVEMENT"],
    description:
      "Physiotherapy. Better movement begins with understanding the body.",
    start: 0.97,
    end: 1.001,
    highlightGroups: [],
    cameraPosition: [0, 1.05, 4.4],
    // Same right-of-frame offset as the intro: the closing statement sits
    // in the clear left margin, never on top of the skeleton.
    cameraTarget: [-0.5, 0.95, 0],
    separate: false,
    textSide: "left",
    keyStructures: [],
  },
];

/** Total vertical scroll length of the pinned anatomy track, in viewport heights. */
export const ANATOMY_TRACK_VH = 850;

/**
 * Body-region number (1–11) for the progress readout. The intro shows 01
 * and the outro holds at 11 — only the eleven anatomy sections count.
 */
export function getAnatomySectionNumber(sectionIndex: number): number {
  return Math.min(11, Math.max(1, sectionIndex));
}
