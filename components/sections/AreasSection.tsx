import { Reveal, ParallaxImage } from "./Reveal";

const AREAS = [
  {
    name: "Back & Spine",
    detail: "Disc, joint and muscular sources of spinal pain.",
  },
  {
    name: "Shoulder",
    detail: "Rotator cuff, impingement and instability.",
  },
  { name: "Knee", detail: "Ligament, meniscus and patellofemoral care." },
  { name: "Hip", detail: "Impingement, bursitis and joint preservation." },
  {
    name: "Sports Rehabilitation",
    detail: "Structured return-to-play for athletes.",
  },
  {
    name: "Post-Surgical Rehabilitation",
    detail: "Guided recovery after orthopaedic surgery.",
  },
  {
    name: "Mobility",
    detail: "Range, balance and confident daily movement.",
  },
  {
    name: "Pain Management",
    detail: "Long-term strategies for persistent pain.",
  },
];

export function AreasSection() {
  return (
    <section
      id="areas"
      className="scroll-mt-16 bg-bg px-6 py-28 md:px-16 md:py-40"
    >
      <div className="mx-auto max-w-content">
        <Reveal>
          <span className="block text-[11px] font-body uppercase tracking-label text-ink-muted">
            Areas We Help
          </span>
          <h2 className="mt-6 max-w-2xl font-display text-3xl leading-[1.12] text-ink md:text-5xl">
            From acute injury to the long arc of recovery.
          </h2>
        </Reveal>

        <Reveal className="mt-12 md:mt-16" y={36}>
          <ParallaxImage
            src="/images/rehab-motion.jpg"
            alt="Patient performing a controlled resistance-band exercise"
            ratio="aspect-[16/10] md:aspect-[21/9]"
            sizes="100vw"
            caption="Rehabilitation is training — dosed, progressed, personal."
          />
        </Reveal>

        <ul className="mt-14 grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-4">
          {AREAS.map((area, i) => (
            <Reveal key={area.name} delay={(i % 4) * 0.07} y={24}>
              <li className="group border-t border-ink/10 py-7 transition-colors duration-300 hover:border-accent">
                <span className="font-body text-[11px] tracking-label text-ink-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 font-display text-xl text-ink transition-colors duration-300 group-hover:text-accent">
                  {area.name}
                </h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-ink-muted">
                  {area.detail}
                </p>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
