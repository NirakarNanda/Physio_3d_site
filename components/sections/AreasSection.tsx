const AREAS = [
  "Back & Spine",
  "Shoulder",
  "Knee",
  "Hip",
  "Sports Rehabilitation",
  "Post-Surgical Rehabilitation",
  "Mobility",
  "Pain Management",
];

export function AreasSection() {
  return (
    <section id="areas" className="scroll-mt-16 bg-bg px-6 py-32 md:px-16 md:py-40">
      <div className="mx-auto max-w-content">
        <span className="block text-[11px] font-body uppercase tracking-label text-ink-muted">
          Areas We Help
        </span>
        <ul className="mt-14 grid grid-cols-1 gap-x-10 gap-y-6 border-t border-ink/10 pt-10 sm:grid-cols-2 md:grid-cols-4">
          {AREAS.map((area) => (
            <li
              key={area}
              className="font-display text-lg text-ink transition-colors hover:text-accent"
            >
              {area}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
