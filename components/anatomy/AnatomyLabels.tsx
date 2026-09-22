"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { gsap } from "@/lib/scroll";
import { anatomyStore } from "@/lib/anatomyStore";
import { anatomySections } from "./anatomyData";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Editorial text panel for the active anatomy section — Aceternity-style
 * dark medical-editorial voice: hairline eyebrow rule, Fraunces serif
 * display title, muted ivory body copy, glass key-structure chips.
 *
 * Section changes choreograph the panel's children in with a staggered
 * GSAP rise (eyebrow → title → copy → chips). Gated on
 * prefers-reduced-motion: no-motion users get the final state instantly.
 */
export function AnatomyLabels() {
  const sectionIndex = useSyncExternalStore(
    anatomyStore.subscribe,
    anatomyStore.getSectionIndex,
    () => 0
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const section = anatomySections[sectionIndex];
  const rightSide = section.textSide === "right";

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        container.children,
        { autoAlpha: 0, y: 20 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.75,
          ease: "power3.out",
          stagger: 0.08,
        }
      );
    }, container);
    return () => ctx.revert();
  }, [sectionIndex, reducedMotion]);

  const alignment =
    section.textSide === "left"
      ? "items-start text-left left-6 md:left-16"
      : rightSide
        ? "items-end text-right right-6 md:right-16"
        : "items-center text-center left-1/2 -translate-x-1/2";

  return (
    <div
      className={`pointer-events-none absolute top-1/2 z-10 flex w-[min(90vw,26rem)] -translate-y-1/2 flex-col ${alignment}`}
    >
      <div ref={containerRef} className="flex flex-col gap-5">
        {section.eyebrow && (
          <div
            className={`flex items-center gap-3 ${
              rightSide ? "flex-row-reverse" : ""
            }`}
          >
            <span className="h-px w-10 bg-accent/80" />
            <span className="font-body text-[11px] uppercase tracking-[0.28em] text-accent">
              {section.eyebrow}
            </span>
          </div>
        )}
        <h3 className="font-editorial text-5xl font-medium leading-[1.02] tracking-tight text-[#F4F1EA] md:text-6xl">
          {section.title.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h3>
        <p className="max-w-xs font-body text-[15px] leading-relaxed text-[#B4B0A6]">
          {section.description}
        </p>
        {section.keyStructures.length > 0 && (
          <ul
            aria-label={`Key structures: ${section.keyStructures.join(", ")}`}
            className={`flex max-w-xs flex-wrap gap-1.5 ${
              rightSide
                ? "justify-end"
                : section.textSide === "center"
                  ? "justify-center"
                  : "justify-start"
            }`}
          >
            {section.keyStructures.map((structure) => (
              <li
                key={structure}
                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-body text-[10px] uppercase tracking-[0.18em] text-[#D8D4CB] backdrop-blur-sm"
              >
                {structure}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
