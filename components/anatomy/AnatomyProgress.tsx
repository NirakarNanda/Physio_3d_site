"use client";

import { useEffect, useRef } from "react";
import { anatomyStore } from "@/lib/anatomyStore";
import { getAnatomySectionNumber } from "./anatomyData";

/**
 * Minimal editorial progress readout for the anatomy chapter: the current
 * section number among the 11 body regions plus a hairline progress bar
 * tracking overall scroll progress. Updated imperatively in a rAF loop —
 * no React re-renders at scroll speed. Decorative (aria-hidden); the
 * section list is already announced via the sr-only summary.
 */
export function AnatomyProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastNum = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const progress = anatomyStore.getProgress();
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${progress})`;
      }
      const num = getAnatomySectionNumber(anatomyStore.getSectionIndex());
      if (num !== lastNum) {
        lastNum = num;
        if (numRef.current) {
          numRef.current.textContent = String(num).padStart(2, "0");
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-6 right-6 z-10 hidden items-center gap-3 md:flex"
    >
      <span
        ref={numRef}
        className="font-editorial text-lg italic tabular-nums text-[#F4F1EA]"
      >
        01
      </span>
      <span className="font-body text-[10px] uppercase tracking-[0.22em] text-[#8E8B83]">
        / 11
      </span>
      <div className="h-px w-24 overflow-hidden bg-white/15">
        <div
          ref={barRef}
          className="h-full w-full origin-left bg-accent"
          style={{ transform: "scaleX(0)" }}
        />
      </div>
    </div>
  );
}
