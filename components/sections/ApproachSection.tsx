import { Reveal, ParallaxImage } from "./Reveal";

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
    <section
      id="approach"
      className="scroll-mt-16 bg-bg-secondary px-6 py-28 md:px-16 md:py-40"
    >
      <div className="mx-auto grid max-w-content grid-cols-1 gap-14 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-5">
          <div className="md:sticky md:top-28">
            <Reveal y={36}>
              <ParallaxImage
                src="/images/spine-illustration.jpg"
                alt="Ink illustration of the human spine in profile"
                ratio="aspect-[3/4]"
                sizes="(max-width: 768px) 100vw, 40vw"
                caption="The vertebral column — thirty-three vertebrae, one kinetic chain."
              />
            </Reveal>
          </div>
        </div>

        <div className="md:col-span-7">
          <Reveal>
            <span className="block text-[11px] font-body uppercase tracking-label text-ink-muted">
              Our Approach
            </span>
            <h2 className="mt-6 max-w-md font-display text-3xl leading-[1.12] text-ink md:text-4xl">
              Four steps. One goal: movement you can trust.
            </h2>
          </Reveal>

          <ol className="mt-12">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.number} delay={Math.min(i * 0.08, 0.24)} y={24}>
                <li className="group flex gap-6 border-t border-ink/10 py-8 transition-transform duration-500 ease-editorial last:border-b hover:-translate-y-0.5 md:gap-10">
                  <span className="font-editorial text-lg text-accent transition-colors group-hover:text-ink">
                    {p.number}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl text-ink md:text-[1.7rem]">
                      {p.title}
                    </h3>
                    <p className="mt-2 max-w-md font-body text-[15px] leading-relaxed text-ink-muted">
                      {p.copy}
                    </p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
