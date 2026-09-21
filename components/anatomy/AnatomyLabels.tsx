"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { gsap } from "@/lib/scroll";
import { anatomyStore } from "@/lib/anatomyStore";
import { anatomySections } from "./anatomyData";
import { useReducedMotion } from "./useReducedMotion";

export function AnatomyLabels() {
  const sectionIndex = useSyncExternalStore(
    anatomyStore.subscribe,
    anatomyStore.getSectionIndex,
    () => 0
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const section = anatomySections[sectionIndex];

  useEffect(() => {
    if (!containerRef.current || reducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" }
      );
    }, containerRef);
    return () => ctx.revert();
  }, [sectionIndex, reducedMotion]);

  const alignment =
    section.textSide === "left"
      ? "items-start text-left left-6 md:left-16"
      : section.textSide === "right"
      ? "items-end text-right right-6 md:right-16"
      : "items-center text-center left-1/2 -translate-x-1/2";

  return (
    <div
      className={`pointer-events-none absolute top-1/2 z-10 flex w-[min(90vw,26rem)] -translate-y-1/2 flex-col gap-4 ${alignment}`}
    >
      <div ref={containerRef} className="flex flex-col gap-4">
        {section.eyebrow && (
          <span className="text-[11px] font-body uppercase tracking-label text-accent">
            {section.eyebrow}
          </span>
        )}
        <h3 className="font-display text-4xl leading-[0.95] text-ink md:text-5xl">
          {section.title.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h3>
        <p className="max-w-xs font-body text-sm leading-relaxed text-ink-muted">
          {section.description}
        </p>
        {section.keyStructures.length > 0 && (
          <ul
            aria-label={`Key structures: ${section.keyStructures.join(", ")}`}
            className={`flex max-w-xs flex-wrap gap-1.5 ${
              section.textSide === "right" ? "justify-end" : section.textSide === "center" ? "justify-center" : "justify-start"
            }`}
          >
            {section.keyStructures.map((structure) => (
              <li
                key={structure}
                className="rounded-full border border-ink/15 bg-bg/70 px-2.5 py-1 font-body text-[10px] uppercase tracking-label text-ink backdrop-blur-sm"
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
