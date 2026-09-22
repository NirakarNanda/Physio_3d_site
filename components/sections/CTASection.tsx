"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { gsap, initScroll, prefersReducedMotion } from "@/lib/scroll";
import { Reveal } from "./Reveal";

export function CTASection() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initScroll();
    const el = glowRef.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0.35, scale: 0.92 },
        {
          opacity: 1,
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "center center",
            scrub: 0.8,
          },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <section
      id="contact"
      className="relative scroll-mt-16 overflow-hidden bg-bg px-6 py-32 md:px-16 md:py-48"
    >
      {/* Ambient sage glow that breathes in as the finale arrives. */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 60% at 50% 50%, rgba(168,183,161,0.22), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-content text-center">
        <Reveal>
          <span className="block text-[11px] font-body uppercase tracking-label text-ink-muted">
            Begin
          </span>
        </Reveal>
        <Reveal delay={0.1} y={36}>
          <h2 className="mx-auto mt-6 max-w-3xl font-display text-4xl leading-[1.05] text-ink md:text-6xl">
            READY TO MOVE BETTER?
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-md font-body text-base leading-relaxed text-ink-muted">
            Start with understanding what your body needs.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {/* TODO: point at the real booking flow once it exists. */}
            <Button href="#contact" variant="primary">
              Book a consultation
            </Button>
            <Button href="#approach" variant="secondary">
              Explore our approach
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
