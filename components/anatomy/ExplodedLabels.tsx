"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { anatomyStore } from "@/lib/anatomyStore";
import { explosionState } from "@/lib/explosion";
import { anatomySections } from "./anatomyData";
import { getExplodeConfig, type ExplodeSectionConfig } from "./explodeView";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Vertical slot for a label, as a fraction of viewport height. Labels are
 * spread evenly across the rail; every section's label defs are ordered
 * top → bottom to match their exploded positions so leader lines never
 * cross.
 */
function slotY(i: number, n: number): number {
  return n === 1 ? 0.5 : 0.3 + (0.45 * i) / (n - 1);
}

/**
 * Neoconda-style exploded-view callouts: thin leader lines with a dot at
 * each part, running to numbered labels on a side rail. One instance serves
 * every anatomy section — the active section's config picks the group, the
 * labels, and which screen edge the rail sits on (always opposite the text
 * panel). Positions are updated imperatively in a rAF loop from the shared
 * per-frame explosion state — no React re-renders at scroll speed.
 *
 * Decorative for assistive tech: the same structures are already named in
 * the key-structure chips and the sr-only summary, so this is aria-hidden.
 */
export function ExplodedLabels() {
  const sectionIndex = useSyncExternalStore(
    anatomyStore.subscribe,
    anatomyStore.getSectionIndex,
    () => 0
  );
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const sectionId = anatomySections[sectionIndex]?.id;
  const cfg: ExplodeSectionConfig | undefined = sectionId
    ? getExplodeConfig(sectionId)
    : undefined;

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg || !cfg || reducedMotion) return;

    const labels = cfg.labels;
    const n = labels.length;
    const leftRail = cfg.railSide === "left";
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
      const st = explosionState;
      // A fast scroll can swap sections mid-frame; only draw anchors that
      // belong to this section's label set.
      if (st.sectionId !== cfg.sectionId) return;
      const f = st.factor;
      const W = st.width;
      const H = st.height;
      if (W === 0 || H === 0) return;

      root.style.opacity = f < 0.02 ? "0" : String(Math.min(1, f * 1.5));
      root.style.visibility = f < 0.02 ? "hidden" : "visible";

      const railX = W * (leftRail ? 0.2 : 0.8);
      for (let i = 0; i < n; i++) {
        const anchor = st.anchors[i];
        const label = labelEls[i];
        const line = lineEls[i];
        const dot = dotEls[i];
        if (!anchor || !label || !line || !dot) continue;

        const sy = H * slotY(i, n);
        // Right rail: labels start just right of the rail, left-aligned.
        // Left rail: labels end just left of the rail, right-aligned.
        label.style.transform = leftRail
          ? `translate(${railX - 14}px, ${sy}px) translate(-100%, -50%)`
          : `translate(${railX + 14}px, ${sy}px) translateY(-50%)`;

        if (!anchor.visible) {
          line.setAttribute("points", "");
          dot.setAttribute("r", "0");
          continue;
        }
        const ax = anchor.x;
        const ay = anchor.y;
        // Short horizontal stub out of the part, then a diagonal run to the
        // label — the classic technical-illustration elbow, mirrored for the
        // left rail.
        const points = leftRail
          ? `${ax},${ay} ${Math.max(ax - 36, railX + 60)},${ay} ${railX + 12},${sy} ${railX + 5},${sy}`
          : `${ax},${ay} ${Math.min(ax + 36, railX - 60)},${ay} ${railX - 12},${sy} ${railX - 5},${sy}`;
        line.setAttribute("points", points);
        dot.setAttribute("cx", String(ax));
        dot.setAttribute("cy", String(ay));
        dot.setAttribute("r", "2.5");
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cfg, reducedMotion]);

  if (!cfg || reducedMotion) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 hidden opacity-0 md:block"
    >
      <svg ref={svgRef} className="absolute inset-0 h-full w-full">
        {cfg.labels.map((def) => (
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
      {cfg.labels.map((def) => (
        <div
          key={def.id}
          data-explode-label
          className="absolute left-0 top-0 will-change-transform"
        >
          <span
            className={`whitespace-nowrap font-body text-[10px] uppercase tracking-label text-ink ${
              cfg.railSide === "left" ? "text-right" : ""
            }`}
          >
            <span className="mr-2 text-accent">{def.index}</span>
            {def.title}
          </span>
        </div>
      ))}
    </div>
  );
}
