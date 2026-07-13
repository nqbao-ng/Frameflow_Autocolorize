import { Navbar } from "../../shared/components/Navbar";
import { HeroSection } from "./components/HeroSection";
import { FeaturesSection } from "./components/FeaturesSection";
import { StepsSection } from "./components/StepsSection";
import { ReviewSection } from "./components/ReviewSection";
import { PricingSection } from "./components/PricingSection";
import { CTASection } from "./components/CTASection";
import { FooterSection } from "./components/FooterSection";

export function HomePage() {
  return (
    <div className="landing-page">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <StepsSection />
        <ReviewSection />
        <PricingSection />
        <CTASection />
      </main>
      <FooterSection />
    </div>
  );
}
