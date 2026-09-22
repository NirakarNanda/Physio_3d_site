"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, initScroll } from "@/lib/scroll";

const LIGHT = "#F7F5F0"; // matches bg.DEFAULT
const DARK = "#0A0B0D"; // anatomy chapter canvas

/**
 * A scroll-scrubbed color-dissolve band. As it travels through the viewport
 * its background interpolates from `from` to `to`, so a hard light/dark
 * section boundary becomes a smooth crossfade instead of a cut. Scrubbed,
 * so it feels identical scrolling down and back up; no autonomous motion,
 * so it stays comfortable under prefers-reduced-motion.
 */
function DissolveZone({
  from,
  to,
  glow,
  label,
}: {
  from: string;
  to: string;
  /** Fade in a whisper of the destination chapter's ambience toward its end. */
  glow?: "sage" | "warm";
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initScroll();
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { backgroundColor: from },
        {
          backgroundColor: to,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
          },
        }
      );
      if (glowRef.current) {
        gsap.fromTo(
          glowRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          }
        );
      }
    }, ref);
    // Page height grew by the new zones — re-measure all triggers.
    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [from, to]);

  const glowBackground =
    glow === "sage"
      ? "radial-gradient(ellipse 58% 46% at 50% 62%, rgba(168,183,161,0.14), transparent 70%)"
      : "radial-gradient(ellipse 58% 46% at 50% 38%, rgba(201,166,139,0.10), transparent 70%)";

  return (
    <div
      ref={ref}
      aria-hidden="true"
      aria-label={label}
      className="relative h-[60vh] w-full"
      style={{ backgroundColor: from }}
    >
      {glow && (
        <div
          ref={glowRef}
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{ background: glowBackground }}
        />
      )}
    </div>
  );
}

/** Hero (light) → anatomy chapter (dark): the "odd hard cut" fix. */
export function LightToDarkTransition() {
  return (
    <DissolveZone
      from={LIGHT}
      to={DARK}
      glow="sage"
      label="Transition into the dark anatomy chapter"
    />
  );
}

/** Anatomy chapter (dark) → Movement section (light): symmetric dissolve out. */
export function DarkToLightTransition() {
  return (
    <DissolveZone
      from={DARK}
      to={LIGHT}
      glow="warm"
      label="Transition out of the dark anatomy chapter"
    />
  );
}
