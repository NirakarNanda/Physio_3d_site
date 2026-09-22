import { Reveal, ParallaxImage } from "./Reveal";

export function HumanSideSection() {
  return (
    <section
      id="human-side"
      className="scroll-mt-16 bg-bg-secondary px-6 py-28 md:px-16 md:py-40"
    >
      <div className="mx-auto grid max-w-content grid-cols-1 items-center gap-14 md:grid-cols-12 md:gap-10">
        <Reveal className="md:col-span-6" y={36}>
          <ParallaxImage
            src="/images/treatment-hands.jpg"
            alt="Physiotherapist's hands guiding a patient's shoulder"
            ratio="aspect-[4/5]"
            sizes="(max-width: 768px) 100vw, 50vw"
            caption="Manual therapy, guided by assessment — never guesswork."
          />
        </Reveal>

        <div className="md:col-span-6">
          <Reveal>
            <span className="block text-[11px] font-body uppercase tracking-label text-ink-muted">
              About
            </span>
            <p className="mt-6 font-display text-3xl leading-[1.15] text-ink md:text-[2.6rem]">
              Behind every movement is a person.
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-6 max-w-md font-body text-[15px] leading-relaxed text-ink-muted">
              Anatomy explains how the body moves. Care is about why it
              matters — getting back to a run, lifting a child, returning to
              work without pain. We keep both in view, together.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <ul className="mt-10 max-w-md space-y-0">
              {[
                "One-to-one sessions, never rushed",
                "A plan that adapts as you improve",
                "Clear explanations at every step",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-4 border-t border-ink/10 py-4 font-body text-sm text-ink last:border-b"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
