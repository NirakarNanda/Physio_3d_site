"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/scroll";

export function Hero() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // prefers-reduced-motion: skip the entrance choreography entirely —
    // content simply renders in its final state.
    if (!rootRef.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        ".hero-eyebrow",
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.7 }
      )
        .fromTo(
          ".hero-line",
          { autoAlpha: 0, y: 28 },
          { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 },
          "-=0.35"
        )
        .fromTo(
          ".hero-sub",
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.7 },
          "-=0.5"
        )
        .fromTo(
          ".hero-mark",
          { autoAlpha: 0, scale: 0.94 },
          { autoAlpha: 1, scale: 1, duration: 1.1 },
          "-=0.9"
        )
        .fromTo(
          ".hero-scroll",
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.6 },
          "-=0.3"
        );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative flex min-h-screen viewport-full w-full items-center overflow-hidden bg-bg px-6 md:px-16"
    >
      <div className="mx-auto grid w-full max-w-content grid-cols-1 items-center gap-12 md:grid-cols-12">
        <div className="md:col-span-7">
          <span className="hero-eyebrow mb-6 block text-[11px] font-body uppercase tracking-label text-ink-muted">
            Physiotherapy &amp; Rehabilitation
          </span>
          <h1 className="font-display text-[13vw] leading-[0.92] text-ink md:text-[6.4vw]">
            <span className="hero-line block">THE SCIENCE</span>
            <span className="hero-line block">OF MOVEMENT.</span>
          </h1>
          <p className="hero-sub mt-8 max-w-sm font-body text-base leading-relaxed text-ink-muted">
            Understanding the body is the first step toward better movement.
          </p>
        </div>

        <div className="hero-mark relative flex justify-center md:col-span-5 md:justify-end">
          <HeroMark />
        </div>
      </div>

      <div className="hero-scroll absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
        <span className="text-[10px] font-body uppercase tracking-label text-ink-muted">
          Scroll
        </span>
        <span className="relative block h-12 w-px overflow-hidden bg-ink/15">
          <span className="scroll-drip absolute inset-x-0 top-0 h-1/2 bg-ink/50" />
        </span>
      </div>

      <style jsx>{`
        .scroll-drip {
          animation: drip 1.8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        }
        @keyframes drip {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(200%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .scroll-drip {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}

/**
 * A restrained abstract vertebral mark — NOT a stand-in for the real
 * anatomical model. It signals "3D / anatomical / precise" in the first
 * viewport without paying for a second WebGL context; the real skeleton
 * takes over immediately as the anatomy section scrolls into view.
 */
function HeroMark() {
  return (
    <svg
      width="220"
      height="420"
      viewBox="0 0 220 420"
      fill="none"
      className="opacity-90"
      aria-hidden="true"
    >
      <circle cx="110" cy="46" r="34" stroke="#171717" strokeWidth="1.2" />
      {Array.from({ length: 11 }).map((_, i) => (
        <ellipse
          key={i}
          cx="110"
          cy={104 + i * 26}
          rx={26 - i * 0.6}
          ry="10"
          stroke={i % 3 === 0 ? "#A8B7A1" : "#171717"}
          strokeWidth="1.1"
          opacity={0.85 - i * 0.03}
        />
      ))}
      <line x1="110" y1="80" x2="110" y2="380" stroke="#171717" strokeWidth="0.6" opacity="0.3" />
    </svg>
  );
}
