"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { label: "Anatomy", href: "#anatomy" },
  { label: "Approach", href: "#approach" },
  { label: "Physiotherapy", href: "#areas" },
  { label: "About", href: "#human-side" },
  { label: "Contact", href: "#contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  // The anatomy chapter is a dark full-viewport experience — invert the
  // fixed nav while it's on screen so the chrome stays legible.
  const [darkSection, setDarkSection] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      const el = document.getElementById("anatomy");
      if (el) {
        const r = el.getBoundingClientRect();
        setDarkSection(r.top <= 80 && r.bottom >= window.innerHeight * 0.5);
      } else {
        setDarkSection(false);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        darkSection
          ? "bg-[#0A0B0D]/85 backdrop-blur-sm"
          : scrolled
            ? "bg-bg/85 backdrop-blur-sm"
            : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-content items-center justify-between px-6 md:px-16">
        <a
          href="#top"
          className={`font-display text-sm tracking-wide transition-colors duration-300 ${
            darkSection ? "text-[#F4F1EA]" : "text-ink"
          }`}
        >
          MERIDIAN&nbsp;PT
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={`text-xs font-body uppercase tracking-label transition-colors duration-300 ${
                  darkSection
                    ? "text-[#B4B0A6] hover:text-[#F4F1EA]"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href="#contact"
          className={`rounded-full border px-4 py-2 text-xs font-body uppercase tracking-label transition-colors duration-300 ${
            darkSection
              ? "border-white/20 text-[#F4F1EA] hover:border-white/50"
              : "border-ink/15 text-ink hover:border-ink/40"
          }`}
        >
          Book a consultation
        </a>
      </nav>
    </header>
  );
}
