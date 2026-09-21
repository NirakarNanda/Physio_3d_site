export function HumanSideSection() {
  return (
    <section id="human-side" className="scroll-mt-16 bg-bg-secondary px-6 py-32 md:px-16 md:py-40">
      <div className="mx-auto grid max-w-content grid-cols-1 items-center gap-14 md:grid-cols-12">
        <div className="md:col-span-6">
          <div className="aspect-[4/5] w-full rounded-sm bg-gradient-to-br from-accent-warm/25 via-bg to-accent/20" />
        </div>
        <div className="md:col-span-6">
          <span className="block text-[11px] font-body uppercase tracking-label text-ink-muted">
            About
          </span>
          <p className="mt-6 font-display text-3xl leading-[1.15] text-ink md:text-4xl">
            Behind every movement is a person.
          </p>
          <p className="mt-6 max-w-md font-body text-sm leading-relaxed text-ink-muted">
            Anatomy explains how the body moves. Care is about why it
            matters — getting back to a run, lifting a child, returning to
            work without pain. We keep both in view, together.
          </p>
        </div>
      </div>
    </section>
  );
}
