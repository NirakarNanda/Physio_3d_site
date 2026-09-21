"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { anatomyStore } from "@/lib/anatomyStore";
import { skullExplosionState } from "@/lib/skullExplosion";
import { anatomySections } from "./anatomyData";
import { SKULL_LABELS } from "./skullExplode";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Vertical slots for the labels, as fractions of viewport height
 * (top → bottom), matching the exploded parts' top-to-bottom order so
 * leader lines never cross.
 */
const SLOT_Y = [0.3, 0.375, 0.45, 0.525, 0.6, 0.675, 0.75];
/** Horizontal rail the labels sit on, as a fraction of viewport width. */
const RAIL_X = 0.8;

/**
 * Neoconda-style exploded-view callouts for the skull: thin leader lines
 * with a dot at each part, running to numbered labels on the right rail.
 * Positions are updated imperatively in a rAF loop from the shared
 * per-frame explosion state — no React re-renders at scroll speed.
 *
 * Decorative for assistive tech: the same structures are already named in
 * the key-structure chips and the sr-only summary, so this is aria-hidden.
 */
export function SkullExplodedLabels() {
  const sectionIndex = useSyncExternalStore(
    anatomyStore.subscribe,
    anatomyStore.getSectionIndex,
    () => 0
  );
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isSkull = anatomySections[sectionIndex]?.id === "skull";

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg || !isSkull || reducedMotion) return;

    const labelEls = Array.from(
      root.querySelectorAll<HTMLElement>("[data-explode-label]")
    );
    const lineEls = Array.from(
      svg.querySelectorAll<SVGPolylineElement>("[data-explode-line]")
    );
    const dotEls = Array.from(
      svg.querySelectorAll<SVGCircleElement>("[data-explode-dot]")
    );

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const st = skullExplosionState;
      const f = st.factor;
      const W = st.width;
      const H = st.height;
      if (W === 0 || H === 0) return;

      root.style.opacity = f < 0.02 ? "0" : String(Math.min(1, f * 1.5));
      root.style.visibility = f < 0.02 ? "hidden" : "visible";

      const railX = W * RAIL_X;
      for (let i = 0; i < SKULL_LABELS.length; i++) {
        const anchor = st.anchors[i];
        const label = labelEls[i];
        const line = lineEls[i];
        const dot = dotEls[i];
        if (!anchor || !label || !line || !dot) continue;

        const slotY = H * SLOT_Y[i];
        label.style.transform = `translate(${railX + 14}px, ${slotY - 9}px)`;

        if (!anchor.visible) {
          line.setAttribute("points", "");
          dot.setAttribute("r", "0");
          continue;
        }
        const ax = anchor.x;
        const ay = anchor.y;
        // Short horizontal stub out of the part, then a diagonal run to the
        // label — the classic technical-illustration elbow.
        const elbowX = Math.min(ax + 36, railX - 60);
        line.setAttribute(
          "points",
          `${ax},${ay} ${elbowX},${ay} ${railX - 12},${slotY} ${railX - 5},${slotY}`
        );
        dot.setAttribute("cx", String(ax));
        dot.setAttribute("cy", String(ay));
        dot.setAttribute("r", "2.5");
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSkull, reducedMotion]);

  if (!isSkull || reducedMotion) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 hidden opacity-0 md:block"
    >
      <svg ref={svgRef} className="absolute inset-0 h-full w-full">
        {SKULL_LABELS.map((def) => (
          <g key={def.id}>
            <polyline
              data-explode-line
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              className="text-ink/40"
              points=""
            />
            <circle
              data-explode-dot
              fill="currentColor"
              className="text-ink/60"
              r={0}
              cx={0}
              cy={0}
            />
          </g>
        ))}
      </svg>
      {SKULL_LABELS.map((def) => (
        <div
          key={def.id}
          data-explode-label
          className="absolute left-0 top-0 will-change-transform"
        >
          <span className="whitespace-nowrap font-body text-[10px] uppercase tracking-label text-ink">
            <span className="mr-2 text-accent">{def.index}</span>
            {def.title}
          </span>
        </div>
      ))}
    </div>
  );
}
