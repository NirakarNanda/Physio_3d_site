const PRINCIPLES = [
  {
    number: "01",
    title: "Assess",
    copy: "A thorough evaluation of movement, history and current limitations.",
  },
  {
    number: "02",
    title: "Understand",
    copy: "Identifying the true source of restriction, not just the symptom.",
  },
  {
    number: "03",
    title: "Restore",
    copy: "Targeted, evidence-based treatment built around your body.",
  },
  {
    number: "04",
    title: "Move",
    copy: "Rebuilding strength and confidence in everyday movement.",
  },
];

export function ApproachSection() {
  return (
    <section id="approach" className="scroll-mt-16 bg-bg-secondary px-6 py-32 md:px-16 md:py-40">
      <div className="mx-auto max-w-content">
        <span className="block text-[11px] font-body uppercase tracking-label text-ink-muted">
          Our Approach
        </span>
        <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-16 md:grid-cols-4">
          {PRINCIPLES.map((p) => (
            <div key={p.number}>
              <span className="font-display text-sm text-accent">{p.number}</span>
              <h3 className="mt-3 font-display text-2xl text-ink">{p.title}</h3>
              <p className="mt-3 font-body text-sm leading-relaxed text-ink-muted">
                {p.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
