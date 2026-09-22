"use client";

import { useSyncExternalStore } from "react";
import { anatomyStore } from "@/lib/anatomyStore";

/**
 * Scroll invitation shown only over the intro frame: micro-type label plus
 * a hairline track with a dot that perpetually travels downward. Pure CSS
 * animation (frozen for prefers-reduced-motion by the global stylesheet);
 * unmounts once the reader leaves the intro.
 */
export function ScrollHint() {
  const sectionIndex = useSyncExternalStore(
    anatomyStore.subscribe,
    anatomyStore.getSectionIndex,
    () => 0
  );
  if (sectionIndex !== 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3"
    >
      <span className="font-body text-[10px] uppercase tracking-[0.32em] text-[#8E8B83]">
        Scroll to explore
      </span>
      <div className="relative h-12 w-px overflow-hidden bg-white/15">
        <div className="animate-scroll-hint absolute left-0 top-0 h-3 w-px bg-accent" />
      </div>
    </div>
  );
}
