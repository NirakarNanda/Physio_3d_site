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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-bg/85 backdrop-blur-sm" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-content items-center justify-between px-6 md:px-16">
        <a href="#top" className="font-display text-sm tracking-wide text-ink">
          MERIDIAN&nbsp;PT
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-xs font-body uppercase tracking-label text-ink-muted transition-colors hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href="#contact"
          className="rounded-full border border-ink/15 px-4 py-2 text-xs font-body uppercase tracking-label text-ink transition-colors hover:border-ink/40"
        >
          Book a consultation
        </a>
      </nav>
    </header>
  );
}
