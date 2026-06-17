import { Navbar } from "../../shared/components/Navbar";
import { HeroSection }     from "./components/HeroSection";
import { FeaturesSection } from "./components/FeaturesSection";
import { StepsSection }    from "./components/StepsSection";
import { PricingSection }  from "./components/PricingSection";
import { CTASection }      from "./components/CTASection";
import { FooterSection }   from "./components/FooterSection";

export function HomePage() {
  return (
    <div style={{ background: "linear-gradient(180deg, #F4F8FF 0%, #FFFFFF 30%)", fontFamily: "'Inter', sans-serif" }}>
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <StepsSection />
      <PricingSection />
      <CTASection />
      <FooterSection />
    </div>
  );
}