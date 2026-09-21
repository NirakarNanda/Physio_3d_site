"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "@studio-freight/lenis";

let initialized = false;
let lenis: Lenis | null = null;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Registers GSAP's ScrollTrigger and (unless the user prefers reduced
 * motion) wires up Lenis smooth scrolling so it stays in sync with
 * ScrollTrigger's measurements. Safe to call multiple times — only runs once.
 * Section 23: "Do not create competing scroll systems." Native scroll stays
 * the source of truth; Lenis only smooths the physics on top of it, and
 * every ScrollTrigger reads through Lenis's own scroll event.
 */
export function initScroll() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  gsap.registerPlugin(ScrollTrigger);

  if (!prefersReducedMotion()) {
    lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis?.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  ScrollTrigger.config({ ignoreMobileResize: true });
}

export function getLenis() {
  return lenis;
}

export { gsap, ScrollTrigger };
