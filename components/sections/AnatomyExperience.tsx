"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { ScrollTrigger, initScroll } from "@/lib/scroll";
import { anatomyStore } from "@/lib/anatomyStore";
import { ANATOMY_TRACK_VH } from "@/components/anatomy/anatomyData";
import { AnatomyLabels } from "@/components/anatomy/AnatomyLabels";
import { ExplodedLabels } from "@/components/anatomy/ExplodedLabels";
import { useReducedMotion } from "@/components/anatomy/useReducedMotion";

// The Canvas touches window/WebGL — keep it out of the server bundle.
const AnatomyScene = dynamic(
  () => import("@/components/anatomy/AnatomyScene").then((m) => m.AnatomyScene),
  { ssr: false }
);

export function AnatomyExperience() {
  const trackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    initScroll();
    if (!trackRef.current) return;

    const trigger = ScrollTrigger.create({
      trigger: trackRef.current,
      start: "top top",
      end: "bottom bottom",
      // No `pin` here on purpose — the sticky canvas below handles pinning
      // via plain CSS `position: sticky`, so ScrollTrigger only has to
      // measure progress, not fight the browser's own scroll pipeline
      // (Section 23: "the user should always be able to scroll naturally").
      onUpdate: (self) => {
        anatomyStore.setProgress(self.progress);
      },
    });

    return () => {
      trigger.kill();
    };
  }, []);

  return (
    <section
      id="anatomy"
      ref={trackRef}
      style={{ height: `${ANATOMY_TRACK_VH}vh` }}
      className="relative"
      aria-label="Interactive human anatomy walkthrough"
    >
      <div className="sticky top-0 h-screen viewport-full w-full overflow-hidden">
        <AnatomyScene />
        <AnatomyLabels />
        <ExplodedLabels />

        {/* CC-BY attribution for the 3D skeleton model (required by the
            license). Kept subtle in the corner of the experience. */}
        <p className="pointer-events-none absolute bottom-3 left-4 z-10 max-w-[240px] font-body text-[10px] leading-snug text-ink-muted/70">
          3D skeleton: &ldquo;CT Derived Human Skeleton&rdquo; by Terrie
          Simmons-Ehrhardt,{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto underline decoration-ink-muted/40 underline-offset-2 hover:text-ink"
          >
            CC-BY 4.0
          </a>
        </p>

        {/* Content required for screen readers / no-motion users lives here
            too, so no information exists only inside the 3D animation
            (Section 20). Visually hidden but present in the DOM. */}
        <span className="sr-only">
          Scroll to explore the skull, spine, thoracic cage, shoulder, arm,
          hand, pelvis, hip, knee, ankle and foot.
        </span>

        {reducedMotion && (
          <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center px-6">
            <p className="max-w-sm text-center text-xs text-ink-muted">
              Motion is reduced based on your system settings. Scroll to move
              through each region.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
