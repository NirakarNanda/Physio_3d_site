"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { anatomyStore } from "@/lib/anatomyStore";
import { explosionState } from "@/lib/explosion";
import { anatomySections } from "./anatomyData";
import { getExplodeConfig, type ExplodeSectionConfig } from "./explodeView";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Vertical slot for a label, as a fraction of viewport height. Labels are
 * spread across the middle band of the rail with generous spacing; every
 * section's label defs are ordered top → bottom to match their exploded
 * positions so leader lines never cross.
 */
function slotY(i: number, n: number): number {
  return n === 1 ? 0.5 : 0.18 + (0.64 * i) / (n - 1);
}

/**
 * Exploded-view callouts in the Aceternity spirit: hairline leader lines
 * with a soft halo dot at each part, running to small editorial labels on
 * a side rail — always on the opposite side from the text panel, so labels
 * and panel copy can never collide. One instance serves every anatomy
 * section; the active section's config picks the group, the labels, and
 * the rail side. Positions update imperatively in a rAF loop from the
 * shared per-frame explosion state — no React re-renders at scroll speed.
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
    const haloEls = Array.from(
      svg.querySelectorAll<SVGCircleElement>("[data-explode-halo]")
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

      const shown = f >= 0.02;
      root.style.opacity = shown ? String(Math.min(1, f * 1.6)) : "0";
      root.style.visibility = shown ? "visible" : "hidden";
      if (!shown) return;

      // Labels drift in from the rail as the explosion ramps — a small
      // choreographed entrance tied to the same scroll driver as the 3D.
      const slide = (1 - Math.min(1, f * 2.2)) * 18 * (leftRail ? -1 : 1);
      const railX = W * (leftRail ? 0.14 : 0.86);
      for (let i = 0; i < n; i++) {
        const anchor = st.anchors[i];
        const label = labelEls[i];
        const line = lineEls[i];
        const dot = dotEls[i];
        const halo = haloEls[i];
        if (!anchor || !label || !line || !dot) continue;

        const sy = H * slotY(i, n);
        // Right rail: labels start just right of the rail, left-aligned.
        // Left rail: labels end just left of the rail, right-aligned.
        label.style.transform = leftRail
          ? `translate(${railX - 14 + slide}px, ${sy}px) translate(-100%, -50%)`
          : `translate(${railX + 14 + slide}px, ${sy}px) translateY(-50%)`;

        if (!anchor.visible) {
          line.setAttribute("points", "");
          dot.setAttribute("r", "0");
          halo?.setAttribute("r", "0");
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
        dot.setAttribute("r", "2");
        halo?.setAttribute("cx", String(ax));
        halo?.setAttribute("cy", String(ay));
        halo?.setAttribute("r", "6");
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
              stroke="#EDE9DF"
              strokeOpacity={0.28}
              strokeWidth={1}
              points=""
            />
            <circle
              data-explode-halo
              fill="#A8B7A1"
              fillOpacity={0.18}
              r={0}
              cx={0}
              cy={0}
            />
            <circle
              data-explode-dot
              fill="#A8B7A1"
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
            className={`flex items-center gap-2 whitespace-nowrap ${
              cfg.railSide === "left" ? "flex-row-reverse" : ""
            }`}
            style={{ textShadow: "0 1px 10px rgba(0,0,0,0.85)" }}
          >
            <span className="font-body text-[10px] tabular-nums text-accent">
              {def.index}
            </span>
            <span className="h-px w-4 bg-white/25" />
            <span className="font-body text-[11px] uppercase tracking-[0.18em] text-[#EDE9DF]">
              {def.title}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
