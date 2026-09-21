import { Button } from "@/components/ui/Button";

export function CTASection() {
  return (
    <section id="contact" className="scroll-mt-16 bg-bg px-6 py-32 md:px-16 md:py-48">
      <div className="mx-auto max-w-content text-center">
        <h2 className="font-display text-4xl leading-[1.05] text-ink md:text-6xl">
          READY TO MOVE BETTER?
        </h2>
        <p className="mx-auto mt-6 max-w-md font-body text-base leading-relaxed text-ink-muted">
          Start with understanding what your body needs.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {/* TODO: point at the real booking flow once it exists. */}
          <Button href="#contact" variant="primary">
            Book a consultation
          </Button>
          <Button href="#approach" variant="secondary">
            Explore our approach
          </Button>
        </div>
      </div>
    </section>
  );
}
