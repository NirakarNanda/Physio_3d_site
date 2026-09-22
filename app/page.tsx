import { Hero } from "@/components/sections/Hero";
import { LightToDarkTransition, DarkToLightTransition } from "@/components/sections/ChapterTransition";
import { AnatomyExperience } from "@/components/sections/AnatomyExperience";
import { MovementSection } from "@/components/sections/MovementSection";
import { ApproachSection } from "@/components/sections/ApproachSection";
import { AreasSection } from "@/components/sections/AreasSection";
import { HumanSideSection } from "@/components/sections/HumanSideSection";
import { CTASection } from "@/components/sections/CTASection";

export default function Home() {
  return (
    <main>
      <Hero />
      <LightToDarkTransition />
      <AnatomyExperience />
      <DarkToLightTransition />
      <MovementSection />
      <ApproachSection />
      <AreasSection />
      <HumanSideSection />
      <CTASection />
    </main>
  );
}
