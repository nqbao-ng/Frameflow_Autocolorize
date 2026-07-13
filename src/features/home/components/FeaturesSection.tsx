import { FEATURES } from "../constants/homeData";
import { FloatingSketch } from "./FloatingSketch";

export function FeaturesSection() {
  return (
    <section id="features" className="landing-section landing-features-section">
      <FloatingSketch
        src="/landing/sketch-pose-white.png"
        className="landing-sketch-features"
      />

      <div className="landing-section-heading">
        <span className="landing-section-eyebrow">CORE WORKFLOW</span>
        <h2>Automation where it helps. Artist control where it matters.</h2>
        <p>
          FrameFlow combines deterministic color propagation with a focused review step,
          rather than generating a new image and changing the artwork.
        </p>
      </div>

      <div className="landing-feature-grid">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="landing-feature-card">
            <div className="landing-feature-icon" style={{ background: feature.bg }}>
              {feature.icon}
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
