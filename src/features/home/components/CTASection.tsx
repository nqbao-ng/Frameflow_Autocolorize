import { Link } from "react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { FloatingSketch } from "./FloatingSketch";

export function CTASection() {
  return (
    <section className="landing-section landing-cta-section">
      <div className="landing-cta-card">
        <FloatingSketch
          src="/landing/sketch-star-white.png"
          className="landing-sketch-cta"
        />
        <div className="landing-cta-glow" />
        <div className="landing-cta-content">
          <Sparkles size={30} />
          <h2>Color the keyframe. Review the uncertain parts. Keep moving.</h2>
          <p>
            Start a FrameFlow project and turn your sketch sequence into consistent colored frames without giving up control of the artwork.
          </p>
          <div className="landing-cta-actions">
            <Link to="/signup" className="landing-button landing-button-primary">
              Start Free <ArrowRight size={17} />
            </Link>
            <Link to="/signin" className="landing-button landing-button-ghost">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
