"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import { gsap, initScroll, prefersReducedMotion } from "@/lib/scroll";

/**
 * Scroll-triggered rise-and-fade reveal for the light editorial sections.
 * Fires once when the block enters the viewport; under
 * prefers-reduced-motion the content simply renders in its final state.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initScroll();
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          delay,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }
      );
    }, ref);
    return () => ctx.revert();
  }, [delay, y]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * Editorial figure with a gentle scroll-scrubbed parallax drift inside its
 * frame. The inner image carries extra bleed so the travel never exposes an
 * edge. Static under prefers-reduced-motion.
 */
export function ParallaxImage({
  src,
  alt,
  ratio = "aspect-[4/3]",
  sizes = "(max-width: 768px) 100vw, 60vw",
  caption,
  className,
}: {
  src: string;
  alt: string;
  ratio?: string;
  sizes?: string;
  caption?: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initScroll();
    if (!ref.current || !innerRef.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        innerRef.current,
        { yPercent: -6 },
        {
          yPercent: 6,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <figure ref={ref} className={`relative ${ratio} overflow-hidden rounded-sm bg-bg-secondary ${className ?? ""}`}>
      <div ref={innerRef} className="absolute inset-x-0 -top-[8%] h-[116%]">
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
        />
      </div>
      {caption && (
        <figcaption className="absolute bottom-4 left-4 max-w-[16rem] font-body text-[11px] leading-relaxed text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Animated number counter — counts up when scrolled into view.
 * Renders the final value immediately under prefers-reduced-motion.
 */
export function StatCounter({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const render = (v: number) =>
      (el.textContent = `${Math.round(v).toLocaleString("en-US")}${suffix}`);
    if (prefersReducedMotion()) {
      render(value);
      return;
    }
    initScroll();
    const obj = { v: 0 };
    const tween = gsap.to(obj, {
      v: value,
      duration: 1.8,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
      onUpdate: () => render(obj.v),
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [value, suffix]);

  return (
    <span ref={ref} className={className}>
      0{suffix}
    </span>
  );
}
