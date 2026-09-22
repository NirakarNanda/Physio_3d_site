import { Reveal, ParallaxImage, StatCounter } from "./Reveal";

const STATS = [
  { value: 206, suffix: "", label: "Bones in the adult skeleton" },
  { value: 600, suffix: "+", label: "Skeletal muscles moving them" },
  { value: 360, suffix: "", label: "Joints where movement happens" },
];

export function MovementSection() {
  return (
    <section className="bg-bg px-6 py-28 md:px-16 md:py-40">
      <div className="mx-auto max-w-content">
        <Reveal>
          <span className="block text-[11px] font-body uppercase tracking-label text-ink-muted">
            Movement Is Personal
          </span>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 items-end gap-12 md:grid-cols-12 md:gap-10">
          <Reveal className="md:col-span-7" y={36}>
            <blockquote className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-10 left-0 select-none font-editorial text-[7rem] leading-none text-accent/40 md:-top-14 md:text-[10rem]"
              >
                &ldquo;
              </span>
              <p className="relative font-display text-3xl leading-[1.18] text-ink md:text-[2.9rem] md:leading-[1.12]">
                Every body carries movement differently — shaped by history,
                habit and injury. Treatment that ignores this rarely lasts.
              </p>
            </blockquote>
            <p className="mt-8 max-w-md font-body text-[15px] leading-relaxed text-ink-muted">
              So we start not with a protocol, but with the person in front of
              us: how they move, where it falters, and what &ldquo;better&rdquo;
              actually looks like in their life.
            </p>
          </Reveal>

          <Reveal className="md:col-span-5" delay={0.15} y={36}>
            <ParallaxImage
              src="/images/movement-editorial.jpg"
              alt="Athlete sprinting mid-stride, captured with motion blur"
              ratio="aspect-[4/5] md:aspect-[3/4]"
              sizes="(max-width: 768px) 100vw, 40vw"
              caption="Power is nothing without control — retraining both."
            />
          </Reveal>
        </div>

        <Reveal className="mt-20 md:mt-28" y={24}>
          <dl className="grid grid-cols-1 gap-y-10 border-t border-ink/10 pt-10 sm:grid-cols-3 sm:gap-x-10">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col">
                <dt className="order-2 mt-3 font-body text-[13px] leading-relaxed text-ink-muted">
                  {s.label}
                </dt>
                <dd className="order-1 font-editorial text-5xl text-ink md:text-6xl">
                  <StatCounter value={s.value} suffix={s.suffix} />
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
